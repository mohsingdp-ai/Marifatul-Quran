/* Marifatul Quran — Service Worker */

const CACHE = "mq-v14";
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

/**
 * Cached audio is always a full 200 body, but media elements ask for byte ranges when
 * seeking. Returning the whole file for a Range request makes the element restart or
 * give up, so slice the cached body into a proper 206 instead.
 */
function audioCacheResponse(cached, request) {
  const range = request.headers.get("range");
  if (!range) return cached;

  return cached.arrayBuffer().then(function (buf) {
    const size = buf.byteLength;
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === "" && m[2] === "")) return cached;

    let start;
    let end;
    if (m[1] === "") {
      // Suffix range: "bytes=-500" means the last 500 bytes.
      start = Math.max(0, size - parseInt(m[2], 10));
      end = size - 1;
    } else {
      start = parseInt(m[1], 10);
      end = m[2] === "" ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
    }

    if (start > end || start >= size) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": "bytes */" + size }
      });
    }

    return new Response(buf.slice(start, end + 1), {
      status: 206,
      statusText: "Partial Content",
      headers: {
        "Content-Type": cached.headers.get("Content-Type") || "audio/ogg",
        "Content-Length": String(end - start + 1),
        "Content-Range": "bytes " + start + "-" + end + "/" + size,
        "Accept-Ranges": "bytes"
      }
    });
  }).catch(function () {
    return cached;
  });
}

const STATIC = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./data.js",
  "./verses.js",
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

/**
 * Recordings that were corrected in place. Their URLs did not change, and the audio cache is
 * keyed by URL and never expires, so a client that already downloaded the wrong take would
 * keep playing it forever. Evict just these instead of dropping the whole audio cache, which
 * would cost offline users every track they have saved.
 */
const AUDIO_EVICT = [
  // Para 1's opening recording is Al-Baqarah 1-7, not Al-Fatihah; it moved to a truthful
  // name, so the old URL is dead weight in any cache that already holds it.
  "./audio/1/1__R1__Al-Fatihah.opus",
  "./audio/2/2__R8__Al-Baqarah.ogg",
  "./audio/6/6__R13__Al-Ma'idah.opus",
  // An-Nisa R1 was re-cut (8:10 -> 5:46) and re-exported over the same URL, so a client
  // holding the old take would keep playing the sections that were meant to come out.
  "./audio/5/5__R1__An-Nisa.opus",
  // Para 20's recordings sat one ruku early: every slot from R2 on carried the previous
  // ruku's lecture. The URLs did not change, only what is behind them, so any client that
  // downloaded them holds the wrong lecture. R1 and R17 are gone entirely.
  "./audio/20/20__R2__An-Naml.opus",
  "./audio/20/20__R3__An-Naml.opus",
  "./audio/20/20__R4__An-Naml.opus",
  "./audio/20/20__R5__Al-Qasas.opus",
  "./audio/20/20__R6__Al-Qasas.opus",
  "./audio/20/20__R7__Al-Qasas.opus",
  "./audio/20/20__R8__Al-Qasas.opus",
  "./audio/20/20__R9__Al-Qasas.opus",
  "./audio/20/20__R10__Al-Qasas.opus",
  "./audio/20/20__R11__Al-Qasas.opus",
  "./audio/20/20__R12__Al-Qasas.opus",
  "./audio/20/20__R1__An-Naml.opus",
  "./audio/20/20__R17__Al-'Ankabut.opus",
  // Para 21 had the same fault from R13 on: each slot carried the previous ruku's lecture.
  // Same URLs, different contents, so a cached copy is the wrong lecture. R19 is gone — its
  // three ayat are the tail of a ruku the next para records.
  "./audio/21/21__R13__As-Sajdah.opus",
  "./audio/21/21__R14__As-Sajdah.opus",
  "./audio/21/21__R15__As-Sajdah.opus",
  "./audio/21/21__R16__Al-Ahzab.opus",
  "./audio/21/21__R17__Al-Ahzab.opus",
  "./audio/21/21__R18__Al-Ahzab.opus",
  "./audio/21/21__R19__Al-Ahzab.opus",
  // Byte copies of their siblings that no row referenced; dropped, so a client holding them
  // is holding a URL that no longer exists.
  "./audio/22/22__R6__Al-Ahzab.opus",
  "./audio/22/22__R19__Ya-Sin.opus"
];

function evictCorrectedAudio() {
  return caches.open(AUDIO_CACHE).then(function (cache) {
    return Promise.all(AUDIO_EVICT.map(function (rel) {
      var href;
      try { href = new URL(rel, self.registration.scope).href; } catch (err) { href = rel; }
      return cache.delete(href, { ignoreSearch: true }).catch(function () { /* not cached */ });
    }));
  }).catch(function () { /* audio cache unavailable */ });
}

self.addEventListener("activate", function (e) {
  e.waitUntil(
    Promise.all([
      caches.keys().then(function (keys) {
        return Promise.all(
          keys.filter(function (k) { return k !== CACHE && k !== AUDIO_CACHE; })
              .map(function (k) { return caches.delete(k); })
        );
      }),
      evictCorrectedAudio()
    ])
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
          if (cached) return audioCacheResponse(cached, e.request);
          return fetch(e.request).then(function (res) {
            // Only whole, successful bodies are worth keeping. A 206 slice or an error
            // page stored here would fail to decode on every later play of this track,
            // and Cache.put rejects on 206 anyway.
            if (res.status === 200) {
              cache.put(e.request, res.clone()).catch(function () { /* quota / unsupported */ });
            }
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
