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
    cycleStatus: cycleStatus,
    applyRevisionToggle: applyRevisionToggle,
    computeParaProgress: computeParaProgress,
    computeOverall: computeOverall,
    serialize: serialize,
    parseAndMerge: parseAndMerge
  };
});
