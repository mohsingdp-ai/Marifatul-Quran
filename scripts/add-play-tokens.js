/**
 * Adds opaque playToken to each QURAN_DATA row for player deep links (?t=...).
 * Preserves existing tokens so shared URLs keep working.
 * Run: node scripts/add-play-tokens.js
 */
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const dataPath = path.join(__dirname, "..", "data.js");

function newToken() {
  return crypto.randomBytes(12).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let text = fs.readFileSync(dataPath, "utf8");
const lines = text.split("\n");
const keyToToken = new Map();

for (const line of lines) {
  const pm = line.match(/para: (\d+), rukuInPara: "([^"]+)"/);
  const tm = line.match(/playToken:\s*"([^"]+)"/);
  if (pm && tm) keyToToken.set(pm[1] + "|" + pm[2], tm[1]);
}

const used = new Set(keyToToken.values());
function allocToken(key) {
  let t = keyToToken.get(key);
  if (t) return t;
  do {
    t = newToken();
  } while (used.has(t));
  used.add(t);
  keyToToken.set(key, t);
  return t;
}

const out = [];
for (const line of lines) {
  if (!/^\s*\{ para: \d+, rukuInPara:/.test(line) || line.includes("playToken")) {
    out.push(line);
    continue;
  }
  const pm = line.match(/para: (\d+), rukuInPara: "([^"]+)"/);
  if (!pm) {
    out.push(line);
    continue;
  }
  const tok = allocToken(pm[1] + "|" + pm[2]);
  const nl = line.replace(/\}(,?)\s*$/, ', playToken: "' + tok + '" }$1');
  out.push(nl);
}

fs.writeFileSync(dataPath, out.join("\n"), "utf8");
console.log("Updated", dataPath, "— play tokens:", keyToToken.size);
