"use strict";
const test = require("node:test");
const assert = require("node:assert");
const Hifz = require("../hifz.js");

test("keyFor builds stable para:ruku key", () => {
  assert.strictEqual(Hifz.keyFor(1, "R7"), "1:R7");
  assert.strictEqual(Hifz.keyFor("2", "R10"), "2:R10");
});

test("setMemorized stars and unstars, keeping the listen count", () => {
  const on = Hifz.setMemorized({ p: 3, at: "old" }, true, "2026-09-02");
  assert.deepStrictEqual(on, { p: 3, at: "2026-09-02", s: "memorized" });
  const off = Hifz.setMemorized(on, false, "2026-09-03");
  assert.deepStrictEqual(off, { p: 3, at: "2026-09-03" });
  // starring a ruku that was never listened to
  assert.deepStrictEqual(Hifz.setMemorized(undefined, true, "d"), { p: 0, at: "d", s: "memorized" });
  // unstarring one with no listens leaves nothing to store
  assert.strictEqual(Hifz.setMemorized({ s: "memorized", p: 0, at: "d" }, false, "d"), null);
  assert.strictEqual(Hifz.setMemorized(undefined, false, "d"), null);
});

test("recordPlay counts a full listen and keeps the star", () => {
  assert.deepStrictEqual(Hifz.recordPlay(undefined, "d"), { p: 1, at: "d" });
  const starred = Hifz.recordPlay({ s: "memorized", p: 4, at: "old" }, "new");
  assert.deepStrictEqual(starred, { p: 5, at: "new", s: "memorized" });
});

test("setMemorized and recordPlay do not mutate the input", () => {
  const e = { s: "memorized", p: 2, at: "d" };
  Hifz.setMemorized(e, false, "x");
  Hifz.recordPlay(e, "x");
  assert.deepStrictEqual(e, { s: "memorized", p: 2, at: "d" });
});

test("playsLabel shows exact counts up to five, then 5+", () => {
  assert.strictEqual(Hifz.playsLabel(0), "0");
  assert.strictEqual(Hifz.playsLabel(1), "1");
  assert.strictEqual(Hifz.playsLabel(5), "5");
  assert.strictEqual(Hifz.playsLabel(6), "5+");
  assert.strictEqual(Hifz.playsLabel(40), "5+");
  assert.strictEqual(Hifz.playsLabel(undefined), "0");
});

test("plays tolerates missing, negative and fractional counts", () => {
  assert.strictEqual(Hifz.plays(undefined), 0);
  assert.strictEqual(Hifz.plays({ s: "memorized" }), 0);
  assert.strictEqual(Hifz.plays({ p: -2 }), 0);
  assert.strictEqual(Hifz.plays({ p: 2.7 }), 2);
  assert.strictEqual(Hifz.plays({ p: "3" }), 3);
});

test("normalizeEntry folds the old learning/revision shape into star + count", () => {
  assert.deepStrictEqual(Hifz.normalizeEntry({ s: "memorized", rev: true, at: "d" }), { p: 0, at: "d", s: "memorized" });
  // learning with no listens carries nothing forward
  assert.strictEqual(Hifz.normalizeEntry({ s: "learning", rev: false, at: "d" }), null);
  // but its listens do
  assert.deepStrictEqual(Hifz.normalizeEntry({ s: "learning", p: 2, at: "d" }), { p: 2, at: "d" });
  assert.strictEqual(Hifz.normalizeEntry(undefined), null);
  assert.strictEqual(Hifz.normalizeEntry("junk"), null);
});

test("normalizeMap reports whether anything changed and is idempotent", () => {
  const old = {
    "1:R1": { s: "memorized", rev: false, at: "d" },
    "1:R2": { s: "learning", rev: false, at: "d" },
  };
  const first = Hifz.normalizeMap(old);
  assert.strictEqual(first.changed, true);
  assert.deepStrictEqual(Object.keys(first.map), ["1:R1"]);
  const second = Hifz.normalizeMap(first.map);
  assert.strictEqual(second.changed, false);
  assert.deepStrictEqual(second.map, first.map);
});

test("computeParaProgress counts memorized and listened against total", () => {
  const map = {
    "1:R1": { s: "memorized", p: 3, at: "d" },
    "1:R2": { s: "memorized", p: 0, at: "d" },
    "1:R3": { p: 1, at: "d" },
    "2:R1": { s: "memorized", p: 9, at: "d" }, // other para, ignored
  };
  const rukus = ["R1", "R2", "R3", "R4"];
  assert.deepStrictEqual(Hifz.computeParaProgress(map, 1, rukus), { memorized: 2, listened: 2, total: 4 });
});

test("computeParaProgress on empty map is all zeros with correct total", () => {
  assert.deepStrictEqual(Hifz.computeParaProgress({}, 3, ["R1", "R2"]), { memorized: 0, listened: 0, total: 2 });
});

test("computeOverall counts only memorized across all keys", () => {
  const map = {
    "1:R1": { s: "memorized", p: 0, at: "d" },
    "1:R2": { p: 4, at: "d" },
    "2:R1": { s: "memorized", p: 1, at: "d" },
  };
  assert.deepStrictEqual(Hifz.computeOverall(map, ["1:R1", "1:R2", "1:R3", "2:R1"]), { memorized: 2, total: 4 });
});

test("serialize wraps the map with version + exportedAt", () => {
  const map = { "1:R1": { s: "memorized", p: 2, at: "d" } };
  const out = Hifz.serialize(map, "2026-07-16");
  assert.strictEqual(out.version, 2);
  assert.strictEqual(out.exportedAt, "2026-07-16");
  assert.deepStrictEqual(out.data, map);
});

test("parseAndMerge merges, imported wins on conflict, keeps existing, skips unknown", () => {
  const existing = {
    "1:R1": { p: 1, at: "old" },
    "1:R2": { s: "memorized", p: 0, at: "old" },
  };
  const imported = {
    version: 2,
    data: {
      "1:R1": { s: "memorized", p: 6, at: "new" }, // conflict -> imported wins
      "1:R3": { p: 2, at: "new" }, // new valid
      "99:R9": { s: "memorized", p: 0, at: "new" }, // unknown -> skipped
    },
  };
  const valid = new Set(["1:R1", "1:R2", "1:R3"]);
  const res = Hifz.parseAndMerge(existing, imported, valid);
  assert.strictEqual(res.imported, 2);
  assert.strictEqual(res.skipped, 1);
  assert.deepStrictEqual(res.merged["1:R1"], { p: 6, at: "new", s: "memorized" });
  assert.strictEqual(res.merged["1:R2"].at, "old"); // untouched existing kept
  assert.deepStrictEqual(res.merged["1:R3"], { p: 2, at: "new" });
  assert.ok(!res.merged["99:R9"]);
});

test("parseAndMerge normalizes a version-1 backup and drops empty learning entries", () => {
  const imported = {
    version: 1,
    data: {
      "1:R1": { s: "memorized", rev: true, at: "d" },
      "1:R2": { s: "learning", rev: false, at: "d" },
    },
  };
  const res = Hifz.parseAndMerge({}, imported, new Set(["1:R1", "1:R2"]));
  assert.strictEqual(res.imported, 1);
  assert.strictEqual(res.skipped, 1);
  assert.deepStrictEqual(res.merged["1:R1"], { p: 0, at: "d", s: "memorized" });
  assert.ok(!res.merged["1:R2"]);
});

test("parseAndMerge accepts a bare map (no version wrapper)", () => {
  const res = Hifz.parseAndMerge({}, { "1:R1": { s: "memorized", p: 1, at: "d" } }, new Set(["1:R1"]));
  assert.strictEqual(res.imported, 1);
  assert.strictEqual(res.merged["1:R1"].s, "memorized");
});

test("parseAndMerge does not mutate existing map", () => {
  const existing = { "1:R2": { s: "memorized", p: 0, at: "old" } };
  Hifz.parseAndMerge(existing, { data: { "1:R1": { p: 1, at: "d" } } }, new Set(["1:R1", "1:R2"]));
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
    "19:R5": { s: "memorized", p: 2, at: "2026-01-02" },
    "19:R6": { s: "memorized", p: 5, at: "2026-03-04" },
  };
  const res = Hifz.migrateKeys(map, new Set(["19:R5-R6"]));
  assert.strictEqual(res.migrated, 2);
  assert.deepStrictEqual(res.unmatched, []);
  assert.deepStrictEqual(res.merged["19:R5-R6"], { p: 5, at: "2026-03-04", s: "memorized" });
  assert.ok(!res.merged["19:R5"]);
});

test("migrateKeys unstars a merge when only part of it was memorized, keeping listens", () => {
  const half = Hifz.migrateKeys({ "19:R5": { s: "memorized", p: 3, at: "d" } }, new Set(["19:R5-R6"]));
  assert.deepStrictEqual(half.merged["19:R5-R6"], { p: 3, at: "d" });

  const mixed = Hifz.migrateKeys(
    {
      "19:R5": { s: "memorized", p: 0, at: "d" },
      "19:R6": { p: 1, at: "d" },
    },
    new Set(["19:R5-R6"])
  );
  assert.deepStrictEqual(mixed.merged["19:R5-R6"], { p: 1, at: "d" });
});

test("migrateKeys drops a merge with nothing to keep", () => {
  const res = Hifz.migrateKeys({ "19:R5": { s: "learning", rev: false, at: "d" } }, new Set(["19:R5-R6"]));
  assert.strictEqual(res.migrated, 1);
  assert.ok(!res.merged["19:R5-R6"]);
  assert.ok(!res.merged["19:R5"]);
});

test("migrateKeys leaves untouched keys alone and keeps unrecognised ones", () => {
  const res = Hifz.migrateKeys(
    {
      "1:R7": { p: 2, at: "d" },
      "99:R1": { s: "memorized", p: 0, at: "d" },
    },
    new Set(["1:R7", "19:R5-R6"])
  );
  assert.strictEqual(res.merged["1:R7"].p, 2);
  assert.strictEqual(res.migrated, 0);
  assert.deepStrictEqual(res.unmatched, ["99:R1"]);
  // kept, not deleted — nothing reads it, and a later data.js change may reclaim it
  assert.strictEqual(res.merged["99:R1"].s, "memorized");
});

test("migrateKeys is idempotent — re-running on migrated data changes nothing", () => {
  const valid = new Set(["19:R5-R6"]);
  const once = Hifz.migrateKeys(
    {
      "19:R5": { s: "memorized", p: 1, at: "d" },
      "19:R6": { s: "memorized", p: 2, at: "d" },
    },
    valid
  );
  const twice = Hifz.migrateKeys(once.merged, valid);
  assert.deepStrictEqual(twice.merged, once.merged);
  assert.strictEqual(twice.migrated, 0);
  assert.deepStrictEqual(twice.unmatched, []);
});

test("migrateKeys does not mutate the input map", () => {
  const map = { "19:R5": { s: "memorized", p: 0, at: "d" } };
  Hifz.migrateKeys(map, new Set(["19:R5-R6"]));
  assert.ok(map["19:R5"]);
  assert.ok(!map["19:R5-R6"]);
});

test("migrateKeys follows a single ruku whose label lost its '+' suffix", () => {
  // data.js dropped the "+" from "R18+" once para 9 stopped running past its printed range.
  const res = Hifz.migrateKeys({ "9:R18+": { s: "memorized", p: 4, at: "2026-08-01" } }, new Set(["9:R18"]));
  assert.strictEqual(res.migrated, 1);
  assert.deepStrictEqual(res.unmatched, []);
  assert.deepStrictEqual(res.merged["9:R18"], { p: 4, at: "2026-08-01", s: "memorized" });
  assert.strictEqual(res.merged["9:R18+"], undefined);
});

test("migrateKeys still prefers a merged key over a same-numbered single one", () => {
  // "19:R5" must fold into the merge, not shadow it, whichever order the Set iterates.
  for (const valid of [new Set(["19:R5-R6", "19:R5x"]), new Set(["19:R5x", "19:R5-R6"])]) {
    const res = Hifz.migrateKeys({ "19:R5": { s: "memorized", p: 1, at: "d" } }, valid);
    assert.deepStrictEqual(res.merged["19:R5-R6"], { p: 1, at: "d" }, "half a merge is not memorized");
    assert.strictEqual(res.merged["19:R5x"], undefined);
  }
});
