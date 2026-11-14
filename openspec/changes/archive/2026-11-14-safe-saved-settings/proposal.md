# Proposal

## Why

When the browser blocks storage (some private modes, Safari "Block all cookies"), the main app's
first settings read throws and app.js stops: the reader gets a blank page. The app must still open,
on default settings.

## What Changes

- app.js reads and writes settings through one safe helper: blocked storage gives the default on
  read and skips the write (settings last this visit only).
- The inline script at the top of index.html (theme, hifz, language, script) gets the same guard.
- Hifz import reports "could not save" when its save fails, instead of a false "imported N".
- No behaviour change when storage works.

## Capabilities

### New Capabilities
- `settings-storage`: how the app keeps settings and hifz progress when browser storage is
  available, blocked, or full.

### Modified Capabilities
<!-- none: no existing specs -->

## Impact

- `app.js`: storage helper; about 50 direct `localStorage` calls switched to it.
- `index.html`: first-paint inline script wrapped in try/catch.
- `i18n.js`: one new message (English + Urdu) for a failed hifz import save.
