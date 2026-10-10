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
   * Resolves { saved, failed, storageFull }.
   */
  function downloadBatch(urls, saveOne, onProgress, concurrency) {
    var result = { saved: 0, failed: 0, storageFull: false };
    var done = 0;
    var index = 0;

    function worker() {
      if (index >= urls.length) return Promise.resolve();
      var url = urls[index++];
      return Promise.resolve().then(function () { return saveOne(url); }).then(function () {
        result.saved++;
      }, function (err) {
        result.failed++;
        if (isQuotaError(err)) result.storageFull = true;
      }).then(function () {
        done++;
        if (onProgress) onProgress(done, urls.length);
        return worker();
      });
    }

    var workers = [];
    for (var i = 0; i < Math.min(concurrency || 10, urls.length); i++) workers.push(worker());
    return Promise.all(workers).then(function () { return result; });
  }

  return { downloadBatch: downloadBatch, isQuotaError: isQuotaError };
});
