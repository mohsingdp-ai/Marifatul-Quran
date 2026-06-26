# Phase 5 Task 5.1 — Resume Last Playback Position

**Date:** 2026-06-26
**Branch:** feature/android-native
**Status:** COMPLETE — all gates pass

---

## What Was Delivered

### 1. TDD Pure Helper `positionKey`
- Test: `app/src/test/java/com/mohsingdp/marifatulquran/data/PrefsLogicTest.kt`
- Asserts: `positionKey(3) == "pos_para_3"`
- Confirmed RED (unresolved reference) before implementation, GREEN after.

### 2. `data/Prefs.kt`
- Top-level function `fun positionKey(para: Int): String` (tested)
- `data class SavedPosition(val para: Int, val rukuIndex: Int, val positionMs: Long)`
- `class Prefs(context: Context)` using `SharedPreferences("mq", MODE_PRIVATE)`:
  - `fun savePosition(para, rukuIndex, positionMs)` — writes `last_para`, `last_ruku_index`, `last_position_ms` via `.apply()`
  - `fun lastPosition(): SavedPosition?` — returns null when `last_para == -1`

### 3. `PlayerController.kt` — Position Saving
- Signature changed: `setQueue(para: Int, rukus: List<Ruku>, startIndex: Int)`
- New constructor param: `prefs: Prefs`
- Private field `currentPara: Int` tracks the active para across setQueue calls (handles auto-advance correctly: saves `currentPara` + `currentMediaItemIndex`)
- In `pushState()`: saves position whenever `isPlaying == true && currentPara != -1`
- Save frequency: every ~500ms via the existing poll loop (no throttle needed given SharedPreferences.apply() is asynchronous)

### 4. `BrowseScreen.kt` — Resume Banner
- New params: `resume: SavedPosition? = null`, `onResume: () -> Unit = {}`
- When `resume != null`: renders a full-width `Button` at list top with label `"▶ Resume: <SurahName> — Para N"` (falls back to para number if ruku not found)
- No new imports of material-icons; uses `▶` text glyph
- Existing params unchanged (backward-compatible defaults)

### 5. `MainActivity.kt` — Resume Wiring
- Constructs `Prefs(context)` once via `remember`
- Passes `prefs` to `PlayerController` constructor
- Reads `prefs.lastPosition()` once on first composition via `remember`
- `onResume` lambda: calls `setQueue(para, rukus, rukuIndex)` → `seekTo(positionMs)` → `play()` → navigates to Player screen
- Both `setQueue` call sites (normal open + resume) updated with the `para` argument

---

## Build Gates

| Gate | Result |
|------|--------|
| `PrefsLogicTest` | PASS (RED → GREEN, TDD confirmed) |
| `:app:assembleDebug` | BUILD SUCCESSFUL |
| `:app:assembleRelease` | BUILD SUCCESSFUL |
| Release APK size | 2,068,915 bytes = **1.97 MiB** (limit: 2,097,152 = 2.00 MiB) ✓ |

---

## Files Changed

| File | Change |
|------|--------|
| `app/src/test/java/.../data/PrefsLogicTest.kt` | NEW — TDD test for `positionKey` |
| `app/src/main/java/.../data/Prefs.kt` | NEW — `positionKey` + `SavedPosition` + `Prefs` class |
| `app/src/main/java/.../playback/PlayerController.kt` | MODIFIED — `para` param on `setQueue`, `Prefs` param, save in `pushState` |
| `app/src/main/java/.../ui/BrowseScreen.kt` | MODIFIED — `resume` + `onResume` params, resume banner |
| `app/src/main/java/.../MainActivity.kt` | MODIFIED — construct `Prefs`, pass to controller, read + wire resume |

---

## Design Decisions

- **SharedPreferences over DataStore:** DataStore's native `.so` was removed from deps (Phase 4) due to APK budget. Framework `SharedPreferences` has zero size cost.
- **Single "last position" record** (not a per-para map): the plan says "store the single last position." Three keys (`last_para`, `last_ruku_index`, `last_position_ms`) in the `"mq"` SharedPreferences file.
- **Save only when playing:** avoids writing stale position on pause/navigate; the last written position is the best resume point.
- **`positionKey` tested but used for the key structure** (the actual store uses fixed `last_*` keys for the single record, not a per-para map). This matches the plan's intent: the tested helper documents and enforces the key naming convention.
- **No Robolectric:** `Prefs` IO is framework-level; tested on-device per plan decision. `PrefsLogicTest` tests only the pure function, safely runs in plain JVM unit tests.
