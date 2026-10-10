"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { downloadBatch, unsavedOnly, saveWithFallback, failMessage, shouldAnnounce } = require("../download.js");

const quota = () => Object.assign(new Error("full"), { name: "QuotaExceededError" });

test("a failed file is counted, and the rest are still saved", async () => {
  const seen = [];
  const progress = [];
  const r = await downloadBatch(["a", "b", "c", "d"], (u) => {
    seen.push(u);
    return u === "b" ? Promise.reject(new Error("HTTP 404")) : Promise.resolve();
  }, (done, total) => progress.push(done + "/" + total), 2);
  assert.deepStrictEqual(seen.sort(), ["a", "b", "c", "d"]);
  assert.deepStrictEqual(r, { saved: 3, failed: 1, storageFull: false });
  assert.strictEqual(progress.at(-1), "4/4");
});

test("a full disk is reported as storage full", async () => {
  const r = await downloadBatch(["a", "b"], (u) => (u === "a" ? Promise.reject(quota()) : Promise.resolve()));
  assert.deepStrictEqual(r, { saved: 1, failed: 1, storageFull: true });
});

test("a save that throws instead of rejecting still counts as failed", async () => {
  const r = await downloadBatch(["a"], () => { throw new Error("boom"); });
  assert.deepStrictEqual(r, { saved: 0, failed: 1, storageFull: false });
});

test("nothing to save resolves at once", async () => {
  assert.deepStrictEqual(await downloadBatch([], () => assert.fail()), { saved: 0, failed: 0, storageFull: false });
});

test("never more than `concurrency` files at once, and progress counts up 1, 2, 3…", async () => {
  const urls = Array.from({ length: 25 }, (_, i) => "f" + i);
  let running = 0, most = 0;
  const progress = [];
  const r = await downloadBatch(urls, () => {
    running++; most = Math.max(most, running);
    return new Promise((res) => setTimeout(res, 1)).then(() => { running--; });
  }, (done) => progress.push(done), 2);
  assert.strictEqual(most, 2);
  assert.deepStrictEqual(progress, urls.map((_, i) => i + 1));
  assert.deepStrictEqual(r, { saved: 25, failed: 0, storageFull: false });
});

test("storage full stops the batch: no new files are started", async () => {
  const seen = [];
  const r = await downloadBatch(["a", "b", "c", "d", "e"], (u) => {
    seen.push(u);
    return u === "b" ? Promise.reject(quota()) : Promise.resolve();
  }, null, 1);
  assert.deepStrictEqual(seen, ["a", "b"]);
  assert.deepStrictEqual(r, { saved: 1, failed: 1, storageFull: true });
});

test("a progress display that throws does not stop the batch", async () => {
  const r = await downloadBatch(["a", "b", "c"], () => Promise.resolve(), () => { throw new Error("ui"); }, 1);
  assert.deepStrictEqual(r, { saved: 3, failed: 0, storageFull: false });
});

test("only files not saved yet are fetched", () => {
  assert.deepStrictEqual(unsavedOnly(["a", "b", "c"], [true, false, false]), ["b", "c"]);
});

test("failure message: storage full wins over n failed, and the count is what was saved", () => {
  assert.deepStrictEqual(failMessage({ saved: 14, failed: 2, storageFull: false }, 16),
    ["download.someFailed", { progress: "14/16", failed: 2 }]);
  assert.deepStrictEqual(failMessage({ saved: 5, failed: 1, storageFull: true }, 16),
    ["download.storageFullBatch", { progress: "5/16", failed: 1 }]);
});

test("file-type fallback: tries the next type, reports the first error", async () => {
  const tried = [];
  const err = (m) => () => { tried.push(m); return Promise.reject(new Error(m)); };
  const steps = { opus: err("HTTP 404"), ogg: err("HTTP 500") };
  await assert.rejects(saveWithFallback(["opus", "ogg"], (u) => steps[u]()), /HTTP 404/);
  assert.deepStrictEqual(tried, ["HTTP 404", "HTTP 500"]);
  assert.strictEqual(await saveWithFallback(["opus", "ogg"], (u) => (u === "ogg" ? Promise.resolve("ok") : Promise.reject(new Error("x")))), "ok");
});

test("file-type fallback: a full disk stops at once", async () => {
  const tried = [];
  await assert.rejects(saveWithFallback(["opus", "ogg"], (u) => { tried.push(u); return Promise.reject(quota()); }),
    { name: "QuotaExceededError" });
  assert.deepStrictEqual(tried, ["opus"]);
});

test("a screen reader hears every 10th count and the last", () => {
  const heard = Array.from({ length: 24 }, (_, i) => i).filter((d) => shouldAnnounce(d, 23));
  assert.deepStrictEqual(heard, [0, 10, 20, 23]);
});
