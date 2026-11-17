"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { build, outDir } = require("../scripts/build-verse-paras.js");

test("asset/verses/para-*.json match verses.js and verses-indopak.js", () => {
  const files = build();
  assert.strictEqual(Object.keys(files).length, 30);
  Object.keys(files).forEach((p) => {
    const onDisk = fs.readFileSync(path.join(outDir, "para-" + p + ".json"), "utf8");
    assert.strictEqual(onDisk, files[p], "para " + p + " is stale: run node scripts/build-verse-paras.js");
  });
});

test("every ayah in a para file has its Indo-Pak text", () => {
  Object.values(build()).forEach((text) => {
    const file = JSON.parse(text);
    Object.values(file.uthmani).forEach((entry) => entry.ayahs.forEach((a) => {
      assert.ok(file.indopak[entry.surahNumber + ":" + a.n], entry.surahNumber + ":" + a.n);
    }));
  });
});
