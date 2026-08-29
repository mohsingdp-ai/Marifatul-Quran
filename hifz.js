/**
 * Hifz (memorization) tracking — pure, DOM-free logic.
 * Shared by app.js (browser, as window.Hifz) and tests (Node, via module.exports).
 *
 * Status entry shape: { s: "learning" | "memorized", rev: boolean, at: "YYYY-MM-DD" }
 * Absence of a key means "not started". Canonical key is "<para>:<rukuInPara>", e.g. "1:R7".
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.Hifz = api;
})(this, function () {
  "use strict";

  var LEARNING = "learning";
  var MEMORIZED = "memorized";

  function keyFor(para, rukuInPara) {
    return String(para) + ":" + String(rukuInPara);
  }

  /**
   * Ruku numbers a label stands for: "R7" -> [7], "R5-R6" -> [5,6], "R19-20" -> [19,20],
   * "R14+" -> [14]. The "+" only means the ruku runs past its printed verse range; it still
   * covers a single ruku, so it must not widen the span.
   */
  function rukuNumbers(label) {
    var nums = [];
    String(label).split("-").forEach(function (part) {
      var m = part.match(/\d+/);
      if (m) nums.push(Number(m[0]));
    });
    return nums;
  }

  var RANK = { learning: 1, memorized: 2 };

  /**
   * Rebuild a saved progress map after rukus were merged in data.js (e.g. "19:R5" + "19:R6"
   * became "19:R5-R6"), so a user's history survives the change instead of being skipped as
   * an unknown key.
   *
   * A merged ruku only counts as memorized when every ruku folded into it was; anything less
   * than that — including a ruku the user never opened — lands on learning, which is honest
   * about the remaining work without throwing the progress away.
   *
   * Keys that match no live ruku are kept as-is and listed in `unmatched`. They are inert —
   * nothing reads them — and a later data.js change may well give them a home again, so
   * deleting a user's saved progress to tidy up is not worth it.
   */
  function migrateKeys(statusMap, validKeys) {
    var valid = validKeys instanceof Set ? validKeys : new Set(validKeys || []);
    var merged = {}, migrated = 0, unmatched = [];

    /* Which valid key, if any, now covers "<para>:<ruku number>". */
    var coverage = {};
    valid.forEach(function (key) {
      var sep = key.indexOf(":");
      if (sep < 0) return;
      var para = key.slice(0, sep);
      var nums = rukuNumbers(key.slice(sep + 1));
      /* Single rukus usually match by name, but not when only the label changed — dropping a
         "+" leaves "9:R18+" pointing at a ruku that is still there under "9:R18". Map them
         too, without letting one shadow a merged key that already claims the number. */
      for (var n = nums[0]; n <= nums[nums.length - 1]; n++) {
        var slot = para + ":" + n;
        if (nums.length > 1 || !(slot in coverage)) coverage[slot] = key;
      }
    });

    var folded = {}; // target key -> list of source entries
    Object.keys(statusMap || {}).forEach(function (key) {
      if (valid.has(key)) { merged[key] = statusMap[key]; return; }
      var sep = key.indexOf(":");
      var nums = sep < 0 ? [] : rukuNumbers(key.slice(sep + 1));
      var target = nums.length === 1 ? coverage[key.slice(0, sep) + ":" + nums[0]] : undefined;
      if (!target) { unmatched.push(key); merged[key] = statusMap[key]; return; }
      (folded[target] = folded[target] || []).push(statusMap[key]);
      migrated++;
    });

    Object.keys(folded).forEach(function (target) {
      var sources = folded[target];
      if (merged[target]) sources = sources.concat([merged[target]]);
      var label = target.slice(target.indexOf(":") + 1);
      var expected = rukuNumbers(label);
      var span = expected.length > 1 ? expected[expected.length - 1] - expected[0] + 1 : 1;
      var allMemorized = sources.length >= span && sources.every(function (e) { return e && e.s === MEMORIZED; });
      var rev = false, at = null;
      sources.forEach(function (e) {
        if (e && e.rev) rev = true;
        if (e && e.at && (at === null || e.at > at)) at = e.at;
      });
      var best = null;
      sources.forEach(function (e) {
        if (e && RANK[e.s] && (!best || RANK[e.s] > RANK[best])) best = e.s;
      });
      if (!best) return;
      merged[target] = {
        s: allMemorized ? MEMORIZED : LEARNING,
        rev: allMemorized ? rev : false,
        at: at
      };
    });

    return { merged: merged, migrated: migrated, unmatched: unmatched };
  }

  /** not started (undefined) -> learning -> memorized -> not started. */
  function cycleStatus(current) {
    if (current === LEARNING) return MEMORIZED;
    if (current === MEMORIZED) return undefined;
    return LEARNING;
  }

  /** Toggle the needs-revision flag; only meaningful on memorized entries. Returns a new entry. */
  function applyRevisionToggle(entry) {
    if (!entry || entry.s !== MEMORIZED) return entry;
    return { s: entry.s, rev: !entry.rev, at: entry.at };
  }

  function computeParaProgress(statusMap, para, rukusInPara) {
    var memorized = 0, learning = 0, revise = 0;
    rukusInPara.forEach(function (ruku) {
      var e = statusMap[keyFor(para, ruku)];
      if (!e) return;
      if (e.s === MEMORIZED) {
        memorized++;
        if (e.rev) revise++;
      } else if (e.s === LEARNING) {
        learning++;
      }
    });
    return { memorized: memorized, learning: learning, revise: revise, total: rukusInPara.length };
  }

  function computeOverall(statusMap, allKeys) {
    var memorized = 0;
    allKeys.forEach(function (k) {
      var e = statusMap[k];
      if (e && e.s === MEMORIZED) memorized++;
    });
    return { memorized: memorized, total: allKeys.length };
  }

  function serialize(statusMap, dateStr) {
    return { version: 1, exportedAt: dateStr || null, data: statusMap || {} };
  }

  /**
   * Merge imported progress into existing. Imported wins on key conflict; existing keys
   * not present in the import are kept; imported keys not in validKeySet are skipped.
   * Accepts either a serialize() wrapper ({data:...}) or a bare map.
   */
  function parseAndMerge(existingMap, importedObj, validKeySet) {
    var incoming = importedObj && importedObj.data ? importedObj.data : (importedObj || {});
    var merged = {};
    var k;
    for (k in (existingMap || {})) {
      if (Object.prototype.hasOwnProperty.call(existingMap, k)) merged[k] = existingMap[k];
    }
    var imported = 0, skipped = 0;
    for (k in incoming) {
      if (!Object.prototype.hasOwnProperty.call(incoming, k)) continue;
      if (validKeySet && !validKeySet.has(k)) { skipped++; continue; }
      merged[k] = incoming[k];
      imported++;
    }
    return { merged: merged, imported: imported, skipped: skipped };
  }

  return {
    LEARNING: LEARNING,
    MEMORIZED: MEMORIZED,
    keyFor: keyFor,
    rukuNumbers: rukuNumbers,
    migrateKeys: migrateKeys,
    cycleStatus: cycleStatus,
    applyRevisionToggle: applyRevisionToggle,
    computeParaProgress: computeParaProgress,
    computeOverall: computeOverall,
    serialize: serialize,
    parseAndMerge: parseAndMerge
  };
});
