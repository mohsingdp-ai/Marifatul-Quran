"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const I18N = require("../i18n.js");

const { en, ur } = I18N.strings;
const root = path.join(__dirname, "..");
const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");

test("English and Urdu have the same keys", () => {
  const missingUr = Object.keys(en).filter((k) => !(k in ur));
  const missingEn = Object.keys(ur).filter((k) => !(k in en));
  assert.deepStrictEqual(missingUr, [], "keys with no Urdu");
  assert.deepStrictEqual(missingEn, [], "keys with no English");
});

test("no empty strings, and both languages use the same placeholders", () => {
  for (const [lang, table] of Object.entries({ en, ur })) {
    for (const [k, v] of Object.entries(table)) {
      assert.ok(typeof v === "string" && v.trim() !== "", lang + " " + k + " is empty");
    }
  }
  for (const k of Object.keys(en)) {
    assert.strictEqual(placeholders(ur[k] || ""), placeholders(en[k]), "placeholders differ for " + k);
  }
});

test("every key the app uses is in the table", () => {
  const used = new Set();
  const grab = (file, re) => {
    const src = fs.readFileSync(path.join(root, file), "utf8");
    for (const m of src.matchAll(re)) used.add(m[1]);
  };
  grab("app.js", /\bi18n\(\s*"([\w.]+)"/g);
  grab("player.html", /\b(?:I18N\.t|i18n)\(\s*["'`]([\w.]+)["'`]/g);
  for (const file of ["index.html", "player.html"]) {
    grab(file, /data-i18n(?:-aria|-title|-placeholder)?="([\w.]+)"/g);
  }
  const unknown = [...used].filter((k) => !(k in en));
  assert.deepStrictEqual(unknown, [], "keys used but not defined");
  assert.ok(used.size > 50, "expected the app's strings to go through the table");
});

test("t() fills placeholders and falls back to the key for an unknown one", () => {
  assert.strictEqual(I18N.t("no.such.key"), "no.such.key");
  const key = Object.keys(en).find((k) => /\{\w+\}/.test(en[k]));
  assert.ok(key, "some string takes a placeholder");
  const name = en[key].match(/\{(\w+)\}/)[1];
  assert.ok(!I18N.t(key, { [name]: "X" }).includes("{" + name + "}"));
});
