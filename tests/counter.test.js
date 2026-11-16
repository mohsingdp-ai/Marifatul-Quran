"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const ID = "3f2b8c1e-9a4d-4e7f-8b2a-1c3d5e7f9a0b";
const fakeDb = () => {
  const runs = [];
  return { runs, prepare: (sql) => ({ bind: (...args) => ({ run: async () => runs.push({ sql, args }) }) }) };
};
const hit = (body, origin = "https://mohsingdp-ai.github.io") =>
  new Request("https://x/hit", { method: "POST", body, headers: { Origin: origin } });

test("counter stores a valid id once per day and rejects bad input", async () => {
  const { default: worker } = await import(path.join(__dirname, "..", "counter", "worker.js"));
  const DB = fakeDb();

  assert.strictEqual((await worker.fetch(hit(ID), { DB })).status, 204);
  assert.deepStrictEqual(DB.runs[0].args, [new Date().toISOString().slice(0, 10), ID]);
  assert.match(DB.runs[0].sql, /INSERT OR IGNORE/);

  assert.strictEqual((await worker.fetch(hit(ID, "https://evil.example"), { DB })).status, 403);
  assert.strictEqual((await worker.fetch(hit("not-an-id"), { DB })).status, 400);
  assert.strictEqual((await worker.fetch(hit(ID + "x"), { DB })).status, 400);
  assert.strictEqual(DB.runs.length, 1);
});
