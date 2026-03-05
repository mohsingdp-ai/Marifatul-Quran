/* Marifatul Quran — Service Worker */

const CACHE = "mq-v4";
const STATIC = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./data.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(STATIC);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (e) {
  var url = e.request.url;

  // Never intercept GitHub API calls
  if (url.includes("api.github.com")) return;

  // All requests: network first, fall back to cache (works offline, always fresh online)
  e.respondWith(
    fetch(e.request).then(function (res) {
      var clone = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
      return res;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});
