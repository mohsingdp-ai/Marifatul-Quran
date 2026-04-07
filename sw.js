/* Marifatul Quran — Service Worker */

const CACHE = "mq-v6";
const MEDIA_NOTIF_TAG = "mq-media";

function mediaNotifIconUrl() {
  try {
    return new URL("./icon-192.png", self.registration.scope).href;
  } catch (e) {
    return "./icon-192.png";
  }
}

self.addEventListener("message", function (event) {
  var d = event.data;
  if (!d || typeof d !== "object") return;

  if (d.type === "MQ_MEDIA_NOTIF_SHOW") {
    var title = d.title || "Marifatul Quran";
    var playing = !!d.playing;
    var opts = {
      body: d.body || "",
      tag: MEDIA_NOTIF_TAG,
      icon: mediaNotifIconUrl(),
      badge: mediaNotifIconUrl(),
      renotify: true,
      requireInteraction: true,
      silent: true,
      ongoing: true,
      data: { scope: self.registration.scope },
      actions: playing
        ? [{ action: "pause", title: "Pause" }]
        : [{ action: "play", title: "Play" }]
    };

    var p = self.registration.showNotification(title, opts);
    if (event.waitUntil) event.waitUntil(p);
    return;
  }

  if (d.type === "MQ_MEDIA_NOTIF_CLOSE") {
    var p = self.registration.getNotifications({ tag: MEDIA_NOTIF_TAG }).then(function (ns) {
      ns.forEach(function (n) {
        n.close();
      });
    });
    if (event.waitUntil) event.waitUntil(p);
  }
});

self.addEventListener("notificationclick", function (event) {
  event.preventDefault();
  var action = event.action;
  var scope = (event.notification.data && event.notification.data.scope) || self.registration.scope;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      var client = null;
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.indexOf(scope) === 0) {
          client = clientList[i];
          break;
        }
      }
      if (!client && clientList.length) client = clientList[0];

      if (client) {
        return client.focus().then(function () {
          if (action === "play" || action === "pause") {
            client.postMessage({ type: "MQ_MEDIA_CONTROL", action: action });
          }
        });
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(scope);
      }
    })
  );
});
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
