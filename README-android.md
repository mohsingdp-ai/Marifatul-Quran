# Marifatul Quran — Native Android App

Native Kotlin (Jetpack Compose + Media3) audio player for the Marifatul Quran ruku recordings. Streams audio from GitHub Pages, with background/lockscreen playback, offline download, resume, speed control. Release APK ≈ **1.88 MB** (arm64).

- **Branch:** `feature/android-native`
- **Package:** `com.mohsingdp.marifatulquran`
- **minSdk** 26 · **target/compile** 36 · Kotlin 2.2.20 · AGP 8.13.2 · Gradle 8.14.5
- Modules: `:core` (pure-Kotlin domain, JVM-tested) + `:app` (Compose/Media3)

## Build

The Android SDK path is read from `local.properties` (gitignored):
```
sdk.dir=C:/Users/Mohsin/AppData/Local/Android/Sdk
```
Then:
```
./gradlew :core:test            # run the domain unit tests
./gradlew :app:assembleRelease  # build the release APK (unsigned unless keystore.properties exists)
```
Output: `app/build/outputs/apk/release/app-arm64-v8a-release[-unsigned].apk`

> Note: this machine needs a modest Gradle heap — `gradle.properties` sets `-Xmx2048m`. A larger heap has caused a native-OOM daemon crash here.

## Release signing (you do this — the keystore is a secret to back up)

1. **Generate a release keystore** (store it OUTSIDE the repo, e.g. `C:\Mohsin\keys\`):
   ```
   "%JAVA_HOME%\bin\keytool" -genkeypair -v ^
     -keystore C:\Mohsin\keys\marifatul-release.keystore ^
     -alias marifatul -keyalg RSA -keysize 2048 -validity 10000
   ```
   **BACK THIS FILE UP.** Losing it means you can never ship an update to the same app.

2. **Create `keystore.properties`** in the project root (gitignored — see `keystore.properties.example`):
   ```
   storeFile=C:/Mohsin/keys/marifatul-release.keystore
   storePassword=...
   keyAlias=marifatul
   keyPassword=...
   ```

3. **Build the signed release:**
   ```
   ./gradlew :app:assembleRelease
   ```
   Confirm size: `pwsh tools/check-apk-size.ps1` (hard limit 2 MB).

## Distribution — sideload via GitHub release + QR

1. Create a GitHub **release** on the repo and attach `app-arm64-v8a-release.apk`.
2. Generate a **QR code** pointing at the release-asset download URL; share it.
3. On the phone: allow "install from unknown sources", scan the QR, install.

**Caveat:** if the old **TWA** (also `com.mohsingdp.marifatulquran`) is installed, uninstall it first — a different signing key blocks the install ("App not installed").

> `gh` on this build machine is read-only on the repo, so publishing the release needs your own GitHub auth.

## What's implemented (Phases 0–6)

Browse 30 paras / 553 rukus (Material 3, teal/gold brand, system Arabic font) · stream from Pages (stock Media3 Opus decoder, no extension) · background + lockscreen (MediaSessionService) · seek / 5 speed presets / auto-advance · resume last position (SharedPreferences) · offline download (per-ruku + per-para, offline-first playback).

**Pending real-device acceptance (Phase 8):** live tap-to-download + airplane-mode offline playback, lockscreen/notification controls, headset buttons. (Emulator software-GPU input was too flaky to tap-test these reliably; the code paths are built and the offline-detection path is verified.)

## Audio + data

- Audio base (single config constant `PAGES_BASE` in `:core`): `https://mohsingdp-ai.github.io/Marifatul-Quran/`
- Ruku list is generated from the web `data.js` into `core/.../RukuData.kt` via `node tools/generate-ruku-data.mjs` (bundled, offline). Regenerate after editing `data.js`.
- URL builder percent-encodes path segments (space→`%20`, apostrophe→`%27`).
- **Known data quirk** (from `data.js`): a few rows' surah name disagrees with the audio filename (para 6 R3/R4; para 25 R7–R9) — cosmetic, carried from source.
