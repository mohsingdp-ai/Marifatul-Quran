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

test("every quoted key in the app exists, ternaries and guide steps too", () => {
  const prefixes = new Set(Object.keys(en).map((k) => k.split(".")[0]));
  const bad = [];
  for (const file of ["app.js", "index.html", "player.html"]) {
    const src = fs.readFileSync(path.join(root, file), "utf8");
    for (const [, k] of src.matchAll(/["'`]([a-z]\w*\.\w+)["'`]/g)) {
      if (prefixes.has(k.split(".")[0]) && !/\.(js|html|css)$/.test(k) && !(k in en)) {
        // guide steps are used as step.key + "Title" / "Body"
        if (!(k + "Title" in en && k + "Body" in en)) bad.push(file + " " + k);
      }
    }
  }
  assert.deepStrictEqual(bad, []);
});

test("Urdu keeps a label word and its number together", () => {
  const split = Object.keys(ur).filter((k) => /(پارہ|رکوع|آیت|آیات) \{/.test(ur[k]));
  assert.deepStrictEqual(split, [], "use \\u00a0, not a space, before the number");
});

test("setLang: numbers isolated only in Urdu, choice saved, unknown language ignored", (t) => {
  const saved = {};
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true, value: { setItem: (k, v) => { saved[k] = v; } },
  });
  t.after(() => { I18N.setLang("en"); delete globalThis.localStorage; });
  assert.strictEqual(I18N.t("card.ruku", { n: 3 }), "Ruku 3");
  I18N.setLang("xx");
  assert.strictEqual(I18N.lang(), "en");
  I18N.setLang("ur");
  assert.strictEqual(saved.ui_lang, "ur");
  assert.ok(I18N.t("card.ruku", { n: 3 }).includes("⁦3⁩"));
  assert.ok(!I18N.t("ayat.headSurah", { surah: "Al-Baqarah", ref: "x" }).includes("⁦Al"));
});
