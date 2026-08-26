"use strict";
const test = require("node:test");
const assert = require("node:assert");
const Hifz = require("../hifz.js");

test("keyFor builds stable para:ruku key", () => {
  assert.strictEqual(Hifz.keyFor(1, "R7"), "1:R7");
  assert.strictEqual(Hifz.keyFor("2", "R10"), "2:R10");
});

test("cycleStatus advances not-started -> learning -> memorized -> not-started", () => {
  assert.strictEqual(Hifz.cycleStatus(undefined), "learning");
  assert.strictEqual(Hifz.cycleStatus("learning"), "memorized");
  assert.strictEqual(Hifz.cycleStatus("memorized"), undefined);
  // unknown/garbage falls back to first step
  assert.strictEqual(Hifz.cycleStatus("nonsense"), "learning");
});

test("applyRevisionToggle flips rev only on memorized entries", () => {
  const mem = { s: "memorized", rev: false, at: "2026-07-16" };
  const toggled = Hifz.applyRevisionToggle(mem);
  assert.strictEqual(toggled.rev, true);
  assert.strictEqual(toggled.s, "memorized");
  // toggling again clears it
  assert.strictEqual(Hifz.applyRevisionToggle(toggled).rev, false);
  // non-memorized entries are unchanged
  const learn = { s: "learning", rev: false, at: "2026-07-16" };
  assert.strictEqual(Hifz.applyRevisionToggle(learn), learn);
  assert.strictEqual(Hifz.applyRevisionToggle(undefined), undefined);
});

test("applyRevisionToggle does not mutate the input", () => {
  const mem = { s: "memorized", rev: false, at: "2026-07-16" };
  Hifz.applyRevisionToggle(mem);
  assert.strictEqual(mem.rev, false);
});

test("computeParaProgress counts memorized/learning/revise against total", () => {
  const map = {
    "1:R1": { s: "memorized", rev: false, at: "d" },
    "1:R2": { s: "memorized", rev: true, at: "d" },
    "1:R3": { s: "learning", rev: false, at: "d" },
    "2:R1": { s: "memorized", rev: false, at: "d" }, // other para, ignored
  };
  const rukus = ["R1", "R2", "R3", "R4"];
  const p = Hifz.computeParaProgress(map, 1, rukus);
  assert.deepStrictEqual(p, { memorized: 2, learning: 1, revise: 1, total: 4 });
});

test("computeParaProgress on empty map is all zeros with correct total", () => {
  const p = Hifz.computeParaProgress({}, 3, ["R1", "R2"]);
  assert.deepStrictEqual(p, { memorized: 0, learning: 0, revise: 0, total: 2 });
});

test("computeOverall counts only memorized across all keys", () => {
  const map = {
    "1:R1": { s: "memorized", rev: false, at: "d" },
    "1:R2": { s: "learning", rev: false, at: "d" },
    "2:R1": { s: "memorized", rev: true, at: "d" },
  };
  const allKeys = ["1:R1", "1:R2", "1:R3", "2:R1"];
  assert.deepStrictEqual(Hifz.computeOverall(map, allKeys), { memorized: 2, total: 4 });
});

test("serialize wraps the map with version + exportedAt", () => {
  const map = { "1:R1": { s: "memorized", rev: false, at: "d" } };
  const out = Hifz.serialize(map, "2026-07-16");
  assert.strictEqual(out.version, 1);
  assert.strictEqual(out.exportedAt, "2026-07-16");
  assert.deepStrictEqual(out.data, map);
});

test("parseAndMerge merges, imported wins on conflict, keeps existing, skips unknown", () => {
  const existing = {
    "1:R1": { s: "learning", rev: false, at: "old" },
    "1:R2": { s: "memorized", rev: false, at: "old" },
  };
  const imported = {
    version: 1,
    data: {
      "1:R1": { s: "memorized", rev: false, at: "new" }, // conflict -> imported wins
      "1:R3": { s: "learning", rev: false, at: "new" }, // new valid
      "99:R9": { s: "memorized", rev: false, at: "new" }, // unknown -> skipped
    },
  };
  const valid = new Set(["1:R1", "1:R2", "1:R3"]);
  const res = Hifz.parseAndMerge(existing, imported, valid);
  assert.strictEqual(res.imported, 2);
  assert.strictEqual(res.skipped, 1);
  assert.strictEqual(res.merged["1:R1"].at, "new"); // imported won
  assert.strictEqual(res.merged["1:R2"].at, "old"); // untouched existing kept
  assert.strictEqual(res.merged["1:R3"].s, "learning"); // new added
  assert.ok(!res.merged["99:R9"]); // unknown skipped
});

test("parseAndMerge accepts a bare map (no version wrapper)", () => {
  const res = Hifz.parseAndMerge({}, { "1:R1": { s: "memorized", rev: false, at: "d" } }, new Set(["1:R1"]));
  assert.strictEqual(res.imported, 1);
  assert.strictEqual(res.merged["1:R1"].s, "memorized");
});

test("parseAndMerge does not mutate existing map", () => {
  const existing = { "1:R2": { s: "memorized", rev: false, at: "old" } };
  Hifz.parseAndMerge(existing, { data: { "1:R1": { s: "learning", rev: false, at: "d" } } }, new Set(["1:R1", "1:R2"]));
  assert.ok(!existing["1:R1"]);
});

test("rukuNumbers reads single, merged and open-ended labels", () => {
  assert.deepStrictEqual(Hifz.rukuNumbers("R7"), [7]);
  assert.deepStrictEqual(Hifz.rukuNumbers("R5-R6"), [5, 6]);
  assert.deepStrictEqual(Hifz.rukuNumbers("R19-20"), [19, 20]);
  // "+" means the ruku runs past its printed verses, not that it spans another ruku
  assert.deepStrictEqual(Hifz.rukuNumbers("R14+"), [14]);
  assert.deepStrictEqual(Hifz.rukuNumbers("R21-R22"), [21, 22]);
});

test("migrateKeys folds both halves of a merged ruku into the combined key", () => {
  const map = {
    "19:R5": { s: "memorized", rev: false, at: "2026-01-02" },
    "19:R6": { s: "memorized", rev: false, at: "2026-03-04" },
  };
  const res = Hifz.migrateKeys(map, new Set(["19:R5-R6"]));
  assert.strictEqual(res.migrated, 2);
  assert.deepStrictEqual(res.unmatched, []);
  assert.strictEqual(res.merged["19:R5-R6"].s, "memorized");
  assert.strictEqual(res.merged["19:R5-R6"].at, "2026-03-04"); // latest of the two
  assert.ok(!res.merged["19:R5"]);
});

test("migrateKeys downgrades to learning when only part of a merged ruku was memorized", () => {
  const half = Hifz.migrateKeys(
    { "19:R5": { s: "memorized", rev: false, at: "d" } },
    new Set(["19:R5-R6"])
  );
  assert.strictEqual(half.merged["19:R5-R6"].s, "learning");

  const mixed = Hifz.migrateKeys(
    {
      "19:R5": { s: "memorized", rev: false, at: "d" },
      "19:R6": { s: "learning", rev: false, at: "d" },
    },
    new Set(["19:R5-R6"])
  );
  assert.strictEqual(mixed.merged["19:R5-R6"].s, "learning");
});

test("migrateKeys carries needs-revision only onto a fully memorized merge", () => {
  const both = Hifz.migrateKeys(
    {
      "29:R17": { s: "memorized", rev: true, at: "d" },
      "29:R18": { s: "memorized", rev: false, at: "d" },
    },
    new Set(["29:R17-R18"])
  );
  assert.strictEqual(both.merged["29:R17-R18"].s, "memorized");
  assert.strictEqual(both.merged["29:R17-R18"].rev, true);

  const partial = Hifz.migrateKeys(
    { "29:R17": { s: "memorized", rev: true, at: "d" } },
    new Set(["29:R17-R18"])
  );
  assert.strictEqual(partial.merged["29:R17-R18"].rev, false);
});

test("migrateKeys leaves untouched keys alone and keeps unrecognised ones", () => {
  const res = Hifz.migrateKeys(
    {
      "1:R7": { s: "learning", rev: false, at: "d" },
      "99:R1": { s: "memorized", rev: false, at: "d" },
    },
    new Set(["1:R7", "19:R5-R6"])
  );
  assert.strictEqual(res.merged["1:R7"].s, "learning");
  assert.strictEqual(res.migrated, 0);
  assert.deepStrictEqual(res.unmatched, ["99:R1"]);
  // kept, not deleted — nothing reads it, and a later data.js change may reclaim it
  assert.strictEqual(res.merged["99:R1"].s, "memorized");
});

test("migrateKeys is idempotent — re-running on migrated data changes nothing", () => {
  const valid = new Set(["19:R5-R6"]);
  const once = Hifz.migrateKeys(
    {
      "19:R5": { s: "memorized", rev: false, at: "d" },
      "19:R6": { s: "memorized", rev: false, at: "d" },
    },
    valid
  );
  const twice = Hifz.migrateKeys(once.merged, valid);
  assert.deepStrictEqual(twice.merged, once.merged);
  assert.strictEqual(twice.migrated, 0);
  assert.deepStrictEqual(twice.unmatched, []);
});

test("migrateKeys does not mutate the input map", () => {
  const map = { "19:R5": { s: "memorized", rev: false, at: "d" } };
  Hifz.migrateKeys(map, new Set(["19:R5-R6"]));
  assert.ok(map["19:R5"]);
  assert.ok(!map["19:R5-R6"]);
});
