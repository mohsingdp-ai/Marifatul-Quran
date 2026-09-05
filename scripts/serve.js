/**
 * Local dev server for the app.
 *
 * Run:  node scripts/serve.js [port]      (default 8787)
 *
 * Always serves from this repo, never caches, and honours Range requests so audio
 * seeking behaves like it does on GitHub Pages. `python -m http.server` sends no
 * Cache-Control, which lets Chrome hold on to a stale data.js/app.js across edits —
 * that is what makes rows show "Path Not found" long after the files are correct.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const applyTimingEdits = require("./apply-timing-edits.js");

const root = path.join(__dirname, "..");
const SAVE_TIMINGS_PATH = "/__save-timings";
const port = Number(process.argv[2]) || 8787;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".opus": "audio/ogg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".xml": "application/xml",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};

function send(res, status, headers, body) {
  res.writeHead(status, Object.assign({ "Cache-Control": "no-store, must-revalidate" }, headers));
  if (body) res.end(body);
  else res.end();
}

/**
 * Save corrected ayah timings into timings.js.
 *
 * The editor in the app keeps its corrections in the browser, which cannot write to the
 * repo — so the Save button posts them here and this applies them exactly as
 * scripts/apply-timing-edits.js does from the command line. The server only ever listens on
 * 127.0.0.1 and only exists while someone is running the app locally, which is the same
 * ground the editor itself stands on.
 */
function saveTimings(req, res) {
  let body = "";
  let tooBig = false;
  req.on("data", function (chunk) {
    body += chunk;
    if (body.length > 2e6) { tooBig = true; req.destroy(); }
  });
  req.on("end", function () {
    if (tooBig) return send(res, 413, { "Content-Type": "application/json" }, '{"error":"too large"}');
    let result;
    try {
      const edits = JSON.parse(body || "{}");
      const src = fs.readFileSync(applyTimingEdits.TIMINGS, "utf8");
      result = applyTimingEdits.applyEdits(src, edits);
      fs.writeFileSync(applyTimingEdits.TIMINGS, result.text);
    } catch (e) {
      return send(res, 500, { "Content-Type": "application/json" },
        JSON.stringify({ error: e.message }));
    }
    const s = result.summary;
    console.log("saved timings: " + s.moved + " moved, " + s.placed + " placed, " +
      s.rukus.length + " ruku(s): " + s.rukus.join(", "));
    send(res, 200, { "Content-Type": "application/json" }, JSON.stringify({
      rukus: s.rukus, moved: s.moved, placed: s.placed, missing: s.missing, detail: s.detail
    }));
  });
}

const server = http.createServer(function (req, res) {
  if (req.method === "POST" && req.url === SAVE_TIMINGS_PATH) return saveTimings(req, res);

  let pathname;
  try {
    pathname = decodeURIComponent(url.parse(req.url).pathname);
  } catch (e) {
    return send(res, 400, { "Content-Type": "text/plain" }, "Bad request");
  }
  if (pathname.endsWith("/")) pathname += "index.html";

  // Resolve inside the repo only — a crafted path must not escape it.
  const filePath = path.join(root, path.normalize(pathname));
  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    return send(res, 403, { "Content-Type": "text/plain" }, "Forbidden");
  }

  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      return send(res, 404, { "Content-Type": "text/plain" }, "Not found: " + pathname);
    }

    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    const range = req.headers.range;
    const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;

    if (m && !(m[1] === "" && m[2] === "")) {
      let start;
      let end;
      if (m[1] === "") {
        start = Math.max(0, stat.size - parseInt(m[2], 10));
        end = stat.size - 1;
      } else {
        start = parseInt(m[1], 10);
        end = m[2] === "" ? stat.size - 1 : Math.min(parseInt(m[2], 10), stat.size - 1);
      }
      if (start > end || start >= stat.size) {
        return send(res, 416, { "Content-Range": "bytes */" + stat.size });
      }
      res.writeHead(206, {
        "Cache-Control": "no-store, must-revalidate",
        "Content-Type": type,
        "Content-Length": end - start + 1,
        "Content-Range": "bytes " + start + "-" + end + "/" + stat.size,
        "Accept-Ranges": "bytes"
      });
      return fs.createReadStream(filePath, { start: start, end: end }).pipe(res);
    }

    res.writeHead(200, {
      "Cache-Control": "no-store, must-revalidate",
      "Content-Type": type,
      "Content-Length": stat.size,
      "Accept-Ranges": "bytes"
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, "127.0.0.1", function () {
  console.log("Marifatul Quran dev server");
  console.log("  serving " + root);
  console.log("  http://127.0.0.1:" + port + "/index.html");
  console.log("  ayah timing corrections save to timings.js via POST " + SAVE_TIMINGS_PATH);
});
