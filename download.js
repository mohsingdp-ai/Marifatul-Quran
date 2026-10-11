/**
 * Saving many recordings for offline — pure, DOM-free logic.
 * Shared by app.js (browser, as window.MqDownload) and tests (Node, via module.exports).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.MqDownload = api;
})(this, function () {
  "use strict";

  function isQuotaError(err) {
    return !!err && err.name === "QuotaExceededError";
  }

  /**
   * Saves each URL with saveOne (returns a Promise), a few at a time. A failed file never
   * stops the rest; it is counted, so the caller can say what is missing instead of "Saved".
   * A full disk stops the batch: no new files are started, so no data is wasted on them.
   * Resolves { saved, failed, storageFull }.
   */
  function downloadBatch(urls, saveOne, onProgress, concurrency) {
    var result = { saved: 0, failed: 0, storageFull: false };
    var done = 0;
    var index = 0;

    function worker() {
      if (index >= urls.length || result.storageFull) return Promise.resolve();
      var url = urls[index++];
      return Promise.resolve().then(function () { return saveOne(url); }).then(function () {
        result.saved++;
      }, function (err) {
        result.failed++;
        if (isQuotaError(err)) result.storageFull = true;
      }).then(function () {
        done++;
        // A broken progress display must not stop the downloads.
        try { if (onProgress) onProgress(done, urls.length); } catch (err) { console.warn("download progress", err); }
        return worker();
      });
    }

    var workers = [];
    for (var i = 0; i < Math.min(concurrency || 10, urls.length); i++) workers.push(worker());
    return Promise.all(workers).then(function () { return result; });
  }

  /** The URLs whose saved[i] is false. */
  function unsavedOnly(urls, saved) {
    return urls.filter(function (u, i) { return !saved[i]; });
  }

  /**
   * Tries each URL in turn (the same recording under other file types) until one saves.
   * A full disk fails at once; otherwise the FIRST error is reported, as it is the real file.
   */
  function saveWithFallback(urls, saveOne) {
    function tryAt(i, firstErr) {
      return Promise.resolve().then(function () { return saveOne(urls[i]); }).catch(function (err) {
        if (isQuotaError(err)) throw err;
        if (i + 1 >= urls.length) throw firstErr || err;
        return tryAt(i + 1, firstErr || err);
      });
    }
    return tryAt(0);
  }

  /** [key, vars] for a batch that missed some files, so a failure never reads as "Saved". */
  function failMessage(r, total) {
    var vars = { progress: r.saved + "/" + total, failed: r.failed };
    return [r.storageFull ? "download.storageFullBatch" : "download.someFailed", vars];
  }

  /** Read out every 10th file and the last, so a screen reader is not flooded with counts. */
  function shouldAnnounce(done, total) {
    return done === 0 || done === total || done % 10 === 0;
  }

  return {
    downloadBatch: downloadBatch, isQuotaError: isQuotaError, unsavedOnly: unsavedOnly,
    saveWithFallback: saveWithFallback, failMessage: failMessage, shouldAnnounce: shouldAnnounce
  };
});
