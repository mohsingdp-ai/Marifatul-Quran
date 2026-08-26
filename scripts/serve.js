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

const root = path.join(__dirname, "..");
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

const server = http.createServer(function (req, res) {
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
});
