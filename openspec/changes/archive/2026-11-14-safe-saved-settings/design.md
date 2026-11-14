# Design

## Context

app.js is one IIFE. It touches `localStorage` directly in ~55 places; only a few sit in
try/catch. Its getters already treat a missing key (`null`) as "use the default". quiz.html,
i18n.js and the row-pins code already wrap storage in try/catch. index.html has a first-paint
inline script that reads four keys with no guard. app.js loads `verses-indopak.js` itself when
the preload is missing, so skipping the preload is safe.

## Goals / Non-Goals

**Goals:**
- One storage helper in app.js; every direct get/set/remove goes through it.
- Blocked storage looks like empty storage to the getters, so their default logic is unchanged.

**Non-Goals:**
- No in-memory fallback store (settings last only until the next read; acceptable for a rare
  case).
- No user-facing warning that storage is blocked.
- player.html and quiz.html: already guarded, untouched.

## Decisions

### A tiny `store` helper at the top of app.js

`store.get(k)` returns the value or `null` on error; `store.set(k, v)` and `store.remove(k)`
return `true`/`false`. Calls are switched by plain search-and-replace, so the diff stays
mechanical and easy to review. Existing try/catch blocks stay; they become harmless.
Alternative: wrap each call site in its own try/catch → ~50 near-identical blocks; rejected.

### A safe `get` inside index.html's first-paint script

A one-line `get(k)` (value or `null` on error) replaces its four reads. `null` already means the
defaults (dark, hifz on, English, Indo-Pak), so the preloads still run.
Alternative (chosen first, changed during apply): wrap the whole script in try/catch and set the
defaults in the catch → skips the preloads and repeats the defaults; rejected.

### Hifz import checks its save

`saveHifzMap` returns the `store.set` result. The import handler shows a new
`hifz.importSaveFailed` message (English + Urdu) when it is `false`. Other hifz saves (marking an
ayah) ignore the result, as today they have no error path.

### Reset keeps `localStorage.clear()` in its own try

The "reset app" flow already guards `clear()`; its restore loop moves to `store.set`.

## Risks / Trade-offs

- [Quota full on a normal hifz mark: the mark is silently not saved] → Same visible result as
  today (an uncaught error the reader never sees); import, the bulk path, now reports it.
- [Search-and-replace hits a string or comment] → Review the diff; only `localStorage.getItem(`,
  `.setItem(`, `.removeItem(` are replaced, in app.js only.
