# Hifz (memorization) tracking with progress — Design

**Date:** 2026-07-16
**App:** Marifatul Quran PWA (static, vanilla JS)
**Branch:** `feature/hifz-tracker`

## Goal

Let a user track memorization (hifz) status per ruku and see progress per Para and
overall, entirely client-side, with export/import for portability.

## Status model — 4 states

Each ruku has a **progress state** plus an independent **needs-revision flag**:

- `not started` (default — no entry stored)
- `learning`
- `memorized`
- `memorized + needs revision` (revision is a flag on a memorized ruku)

### Interaction

- **Tap** the status pill cycles the progress state: `not started → learning → memorized → not started`.
- **Long-press** (and desktop right-click) toggles the **needs-revision** flag. Only
  meaningful on a memorized ruku; on non-memorized rukus long-press is a no-op.
- Rationale: a strict linear 4-state cycle breaks hifz maintenance — after revising you
  want to return to *memorized*, not restart at *not started*. Revision is a flag on
  memorized, not a rung above it.

## Data model & storage

- **Canonical key = `"<para>:<rukuInPara>"`** e.g. `"1:R7"`. NOT `globalIndex` —
  `globalIndex` is the array position in `data.js` and shifts if that file is ever
  reordered, which would silently corrupt months of user data. `para` + `rukuInPara`
  is stable and human-readable (good for the export file too).
- localStorage key **`hifz_status`** → sparse map, only non-default rukus stored:

```json
{
  "1:R7":  { "s": "memorized", "rev": false, "at": "2026-07-16" },
  "1:R8":  { "s": "learning",  "rev": false, "at": "2026-07-16" },
  "2:R3":  { "s": "memorized", "rev": true,  "at": "2026-07-15" }
}
```

- `s`: `"learning"` | `"memorized"` (absence of key = not started)
- `rev`: boolean needs-revision flag
- `at`: ISO date (YYYY-MM-DD) of last change

## UI

### Status pill (per row)
- New always-visible **"Hifz" column**, leftmost (before Ruku #).
- Colored pill per state (theme-aware, reuses existing tokens):
  - not started → `--muted-chip-bg` / `--text-muted`
  - learning → `--warn-chip-bg` / `--warn-chip-fg` (amber)
  - memorized → `--success-bg` / `--success-fg` (green)
  - needs revision → memorized green + gold ring (`--arabic-gold`)
- Renders on **every** ruku regardless of recording presence, and is **not** hidden by
  the "show only recorded" filters. Memorization ≠ recorded.
- Accessible: `role="button"`, `aria-label` describing state + action, keyboard
  Enter/Space cycles, visible focus ring. Title hint: "Tap to advance · Hold to flag for revision".

### Per-Para progress meter (signature element)
- Slim strip between toolbar and table.
- Teal→green fill = memorized fraction of the current Para.
- Small count chips beside it: `5/8 memorized · 2 learning · 1 to revise` (chips hidden
  when their count is 0).
- Overall total on the same strip: `Total: 120/573`.
- Updates live on any status change and on Para switch.

### Export / import (Settings modal)
- New **"Hifz progress"** group in the existing Settings modal:
  - **Export** → downloads `hifz-progress-YYYY-MM-DD.json` (the `hifz_status` map + a small
    header `{ version, exportedAt }`).
  - **Import** → file picker; **merge** semantics (imported entry wins on key conflict;
    existing keys not in file are kept; keys in file not matching any current ruku are
    skipped and counted). Reports `Imported N, skipped M unknown`.
  - **Reset progress** → clears all, behind a confirm.

## Pure module — `hifz.js` (DOM-free, unit-tested)

Exposed to both `window.Hifz` (browser) and `module.exports` (Node test):

- `cycleStatus(current)` → next progress state (`undefined`→`learning`→`memorized`→`undefined`)
- `applyRevisionToggle(entry)` → new entry with `rev` toggled (only if memorized)
- `keyFor(para, rukuInPara)` → `"<para>:<rukuInPara>"`
- `computeParaProgress(statusMap, para, rukusInPara[])` → `{ memorized, learning, revise, total }`
- `computeOverall(statusMap, allKeys[])` → `{ memorized, total }`
- `serialize(statusMap)` → export object
- `parseAndMerge(existingMap, importedObj, validKeySet)` → `{ merged, imported, skipped }`

`app.js` consumes this module for all state transitions and counting; DOM wiring stays in
`app.js`.

## Testing

- **Unit (TDD, tests first):** all pure functions in `hifz.js` via Node's built-in
  `node --test` (zero deps). Covers cycle transitions, revision toggle guard, per-para and
  overall counting, serialize round-trip, merge with conflicts + unknown-key skipping.
- **E2E (Playwright CLI):** serve the app, mark rukus, verify pill state changes, live
  per-para + overall counts, long-press revision toggle, and an export→reset→import
  round-trip restoring state.

## Out of scope (YAGNI)

- Server sync / GitHub persistence (localStorage + manual export/import only).
- Dedicated hifz dashboard screen (per-Para bar + overall total only).
- Per-ayah granularity (ruku-level only).
- Reminders/streaks/goals (those live in the separate native app).
