/**
 * Hifz (memorization) tracking — pure, DOM-free logic.
 * Shared by app.js (browser, as window.Hifz) and tests (Node, via module.exports).
 *
 * Entry shape: { s: "memorized" | absent, p: <full listens>, at: "YYYY-MM-DD" }
 * Absence of a key means never listened to and not memorized. Canonical key is
 * "<para>:<rukuInPara>", e.g. "1:R7".
 *
 * Earlier versions carried a "learning" state and a needs-revision flag. Both are gone: a
 * ruku is either memorized (the star) or not, and the listen count says how far along it is.
 * Old entries are folded into that shape by normalizeEntry.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.Hifz = api;
})(this, function () {
  "use strict";

  var MEMORIZED = "memorized";
  /** Listens are shown exactly up to this many, then as "5+". */
  var PLAYS_CAP = 5;

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

  function isMemorized(entry) {
    return !!entry && entry.s === MEMORIZED;
  }

  function plays(entry) {
    var n = entry && Number(entry.p);
    return n > 0 ? Math.floor(n) : 0;
  }

  /** "0" .. "5", then "5+". */
  function playsLabel(n) {
    n = Number(n) || 0;
    return n > PLAYS_CAP ? PLAYS_CAP + "+" : String(n);
  }

  function makeEntry(memorized, p, at) {
    var out = { p: p, at: at || null };
    if (memorized) out.s = MEMORIZED;
    return out;
  }

  /**
   * An entry in today's shape, or null when there is nothing left worth keeping (an old
   * "learning" entry that was never listened to, for instance).
   */
  function normalizeEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    var memorized = entry.s === MEMORIZED;
    var p = plays(entry);
    if (!memorized && !p) return null;
    return makeEntry(memorized, p, entry.at);
  }

  /** Every entry normalized; `changed` says whether anything differed from what came in. */
  function normalizeMap(map) {
    var out = {}, changed = false;
    Object.keys(map || {}).forEach(function (k) {
      var e = normalizeEntry(map[k]);
      if (!e) { changed = true; return; }
      if (JSON.stringify(e) !== JSON.stringify(map[k])) changed = true;
      out[k] = e;
    });
    return { map: out, changed: changed };
  }

  /** Star on or off. Returns the new entry, or null when nothing is left to store. */
  function setMemorized(entry, on, dateStr) {
    var p = plays(entry);
    if (!on && !p) return null;
    return makeEntry(!!on, p, dateStr || (entry && entry.at));
  }

  /** One more full listen. Returns the new entry. */
  function recordPlay(entry, dateStr) {
    return makeEntry(isMemorized(entry), plays(entry) + 1, dateStr || (entry && entry.at));
  }

  /**
   * Rebuild a saved progress map after rukus were merged in data.js (e.g. "19:R5" + "19:R6"
   * became "19:R5-R6"), so a user's history survives the change instead of being skipped as
   * an unknown key.
   *
   * A merged ruku only counts as memorized when every ruku folded into it was. Its listen
   * count is the most any of them had: the merged recording is one listen, so adding them
   * up would overstate it.
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
      var allMemorized = sources.length >= span && sources.every(isMemorized);
      var p = 0, at = null;
      sources.forEach(function (e) {
        p = Math.max(p, plays(e));
        if (e && e.at && (at === null || e.at > at)) at = e.at;
      });
      if (!allMemorized && !p) { delete merged[target]; return; }
      merged[target] = makeEntry(allMemorized, p, at);
    });

    return { merged: merged, migrated: migrated, unmatched: unmatched };
  }

  function computeParaProgress(statusMap, para, rukusInPara) {
    var memorized = 0, listened = 0;
    rukusInPara.forEach(function (ruku) {
      var e = statusMap[keyFor(para, ruku)];
      if (isMemorized(e)) memorized++;
      if (plays(e)) listened++;
    });
    return { memorized: memorized, listened: listened, total: rukusInPara.length };
  }

  function computeOverall(statusMap, allKeys) {
    var memorized = 0;
    allKeys.forEach(function (k) {
      if (isMemorized(statusMap[k])) memorized++;
    });
    return { memorized: memorized, total: allKeys.length };
  }

  function serialize(statusMap, dateStr) {
    return { version: 2, exportedAt: dateStr || null, data: statusMap || {} };
  }

  /**
   * Merge imported progress into existing. Imported wins on key conflict; existing keys
   * not present in the import are kept; imported keys not in validKeySet, and old entries
   * with nothing left in them once normalized, are skipped.
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
      var e = normalizeEntry(incoming[k]);
      if (!e) { skipped++; continue; }
      merged[k] = e;
      imported++;
    }
    return { merged: merged, imported: imported, skipped: skipped };
  }

  return {
    MEMORIZED: MEMORIZED,
    PLAYS_CAP: PLAYS_CAP,
    keyFor: keyFor,
    rukuNumbers: rukuNumbers,
    isMemorized: isMemorized,
    plays: plays,
    playsLabel: playsLabel,
    normalizeEntry: normalizeEntry,
    normalizeMap: normalizeMap,
    setMemorized: setMemorized,
    recordPlay: recordPlay,
    migrateKeys: migrateKeys,
    computeParaProgress: computeParaProgress,
    computeOverall: computeOverall,
    serialize: serialize,
    parseAndMerge: parseAndMerge
  };
});
