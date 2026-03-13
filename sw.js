/* Marifatul Quran — Service Worker */

const CACHE = "mq-v4";
const AUDIO_CACHE = "mq-audio";
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
        keys.filter(function (k) { return k !== CACHE && k !== AUDIO_CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var data = e.notification.data || {};
  var para = data.para;
  var globalIndex = data.globalIndex;
  var url = "./";
  if (para !== undefined) {
    url += "?para=" + para;
    if (globalIndex !== undefined) url += "&ruku=" + globalIndex;
  }
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (cs) {
      for (var i = 0; i < cs.length; i++) {
        if ("focus" in cs[i]) {
          cs[i].postMessage({ type: "navigate", para: para, globalIndex: globalIndex });
          return cs[i].focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", function (e) {
  var url = e.request.url;

  // Never intercept GitHub API calls
  if (url.includes("api.github.com")) return;

  // Audio files: serve from audio cache first, then network
  if (/\.(opus|ogg|wav)(\?|$)/i.test(url)) {
    e.respondWith(
      caches.open(AUDIO_CACHE).then(function (cache) {
        return cache.match(e.request).then(function (cached) {
          if (cached) return cached;
          return fetch(e.request).then(function (res) {
            var clone = res.clone();
            cache.put(e.request, clone);
            return res;
          });
        });
      }).catch(function () {
        return caches.match(e.request);
      })
    );
    return;
  }

  // All other requests: network first, fall back to cache (works offline, always fresh online)
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
