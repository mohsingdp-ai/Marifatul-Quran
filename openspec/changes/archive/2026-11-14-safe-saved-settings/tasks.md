# Tasks

## 1. Storage helper in app.js

- [x] 1.1 Add `store` (get → value or null; set/remove → true/false) at the top of app.js — verify: `grep -n 'localStorage\.' app.js` lists only the helper and the guarded `clear()`
- [x] 1.2 Switch every `localStorage.getItem/setItem/removeItem` in app.js to `store` — verify: same grep; `node --test tests/` passes

## 2. index.html first-paint script

- [x] 2.1 Give the inline head script a safe `get` for its four reads (blocked → null → defaults) — verify: page paints dark with storage forced to throw

## 3. Hifz import reports a failed save

- [x] 3.1 `saveHifzMap` returns the save result; import shows `hifz.importSaveFailed` on false; add the English and Urdu string — verify: `node --test tests/i18n.test.js` passes

## 4. Integration Verification

- [x] 4.1 Browser, storage forced to throw: app opens, a setting changes, no uncaught storage error, import shows "could not save"
- [x] 4.2 Browser, normal storage: existing settings and hifz progress survive; import shows "imported N"

## Workflow follow-up

- Archive the change: `openspec archive safe-saved-settings --yes`
