"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { downloadBatch } = require("../download.js");

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
