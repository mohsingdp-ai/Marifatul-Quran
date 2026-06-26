# Marifatul Quran — Native Android App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native Kotlin Android audio app for the Marifatul Quran ruku recordings — streaming from GitHub Pages with background/lockscreen playback, offline download, and a Material 3 UI — in a ≤2 MB APK.

**Architecture:** Two Gradle modules. `:core` is a pure-Kotlin (JVM) library holding all domain logic (models, audio-URL building, catalog grouping, playlist/queue, download state) and is developed strictly test-first with fast JVM JUnit tests. `:app` is the Android module (Jetpack Compose + Media3) that consumes `:core`; its framework edges (MediaSessionService, Compose screens) are verified via build + on-device checks rather than unit-TDD. Audio streams from GitHub Pages; the ruku list is generated from the existing `data.js` into a compiled Kotlin source (no runtime parsing, no JSON dependency, fully offline).

**Tech Stack:** Kotlin 2.2.20 · Jetpack Compose (BOM 2026.06.00) · Material 3 · Media3/ExoPlayer 1.10.1 · AGP 8.13.2 · Gradle 8.14.5 · JUnit4 · DataStore (resume position). Build is local Gradle (JDK 17). Distribution is a signed release APK via GitHub release + QR.

## Global Constraints

- **APK size budget:** ≤ 2 MB for the arm64-v8a release APK. HARD. Measured: realistic Compose+Media3 *universal* = 1.92 MB — but that build had no DataStore, partial UI, no icon. Shipped-complete ≈ 2.0–2.1 MB, which **grazes/busts the hard limit**. Strategy: **lean Compose by default** (see lean-deps bullet) to claw back headroom; enforce the gate (Task 7.2); if it still busts, fall to the **proven Views+Media3 (0.83 MB)** path or have the user relax the number. Do NOT silently ship >2.0.
- **Lean dependencies (budget discipline):** do NOT add `navigation-compose` (use a `when`-based screen-state nav in a single Activity), `material-icons-core` (use 2 vector drawables for play/pause), or `lifecycle-viewmodel-compose` (the ViewModels here are plain classes). Each is a convenience that eats the ~80 KB of headroom.
- **Audio decode (NOT yet runtime-verified — Task 0.3 gates it):** the size measurement assumed `.opus`/`.ogg` decode on API 26 with **stock media3 (no FFmpeg/Opus decoder extension)**. High confidence — ExoPlayer ships its own Ogg extractor and decodes via the API-21+ MediaCodec Opus/Vorbis decoders — but if the extension turns out necessary it adds a per-ABI `.so` that breaks the budget and the native premise. Prove it before building out (Task 0.3).
- **minSdk = 26**, **targetSdk = 36**, **compileSdk = 36**. (Only android-36 platform + build-tools 36.1.0 are installed.)
- **Android SDK path** (no env var set) — every module set goes via `local.properties`: `sdk.dir=C:/Users/Mohsin/AppData/Local/Android/Sdk`. `local.properties` is gitignored.
- **JAVA_HOME** = `C:\Mohsin\Softwares\Jdk\amazon-corretto-17\jdk17.0.13_11` (JDK 17 Corretto).
- **Audio base URL** is a single config constant: `https://mohsingdp-ai.github.io/Marifatul-Quran/` (GitHub Pages — measured faster than raw). The relative `audioUrl` from `data.js` is appended after per-segment percent-encoding.
- **URL encoding:** path segments percent-encoded — space → `%20` (NOT `+`), apostrophe → `%27`. Verified against live Pages: `+` → 404; `%20` + literal/`%27` apostrophe → 200.
- **R8 full mode + resourceShrinking ON** for release; **arm64-v8a ABI split**; do NOT depend on `material-icons-extended` (size bomb).
- **Package id:** `com.mohsingdp.marifatulquran`. App label: `Marifatul Quran`.
- **Out of scope (v1):** waveform editor, audio trimming, recording, GitHub-upload admin, remote data.json refresh (bundle-only for now).
- **Gradle memory:** `org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m`, `org.gradle.workers.max=2` — a larger heap caused a native OOM daemon crash on this machine. Build modules one at a time during heavy R8.
- **Branch/worktree:** branch `feature/android-native` off `v4`, isolated worktree at `C:\Mohsin\QuranAccademy\MFF\Marifatul-Quran-android`, created with `--no-checkout` + sparse-checkout to avoid materializing the 1.4 GB of audio/recordings.
- **TDD discipline:** `:core` is strict red→green→refactor. `:app` ViewModels are tested with fake repositories. Media3 service + Compose UI are verified via build + on-device, not unit tests. Commit after every green step.

---

## File Structure

```
Marifatul-Quran-android/                 (worktree root, branch feature/android-native)
├── settings.gradle                      include :core, :app
├── build.gradle                         plugin versions (apply false)
├── gradle.properties                    memory + androidx flags
├── local.properties                     sdk.dir (gitignored)
├── gradlew / gradlew.bat / gradle/      Gradle wrapper (pinned 8.14.5)
├── .gitignore                           build/, local.properties, *.keystore, .gradle/
├── docs/superpowers/plans/2026-06-26-marifatul-quran-android.md   (this plan)
├── tools/
│   └── generate-ruku-data.mjs           data.js -> core RukuData.kt generator (node)
├── core/                                pure-Kotlin JVM library (TDD)
│   ├── build.gradle                     java-library + kotlin(jvm)
│   └── src/
│       ├── main/kotlin/com/mohsingdp/marifatulquran/core/
│       │   ├── Ruku.kt                  domain model
│       │   ├── RukuData.kt              GENERATED: val ALL_RUKUS: List<Ruku>
│       │   ├── AudioUrls.kt             per-segment percent-encoding URL builder
│       │   ├── RukuCatalog.kt           grouping by para, lookups
│       │   ├── Playlist.kt             queue: current/next/previous/auto-advance
│       │   └── DownloadStatus.kt        sealed status model (logic only)
│       └── test/kotlin/com/mohsingdp/marifatulquran/core/
│           ├── AudioUrlsTest.kt
│           ├── RukuCatalogTest.kt
│           ├── RukuDataTest.kt
│           └── PlaylistTest.kt
└── app/                                 Android module (Compose + Media3)
    ├── build.gradle
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml
        ├── res/                         theme colors (teal/gold), launcher icon
        └── java/com/mohsingdp/marifatulquran/
            ├── MainActivity.kt          Compose host + nav
            ├── ui/theme/Theme.kt        M3 color scheme (brand tokens)
            ├── ui/BrowseScreen.kt       LazyColumn of paras/rukus
            ├── ui/PlayerScreen.kt       slider/speed/play/auto-advance
            ├── ui/BrowseViewModel.kt    consumes :core (TDD w/ fake repo)
            ├── playback/PlaybackService.kt   Media3 MediaSessionService
            ├── playback/PlayerController.kt   MediaController wrapper
            ├── data/RukuRepository.kt   interface (impl backed by :core ALL_RUKUS)
            ├── data/Prefs.kt            DataStore resume position
            └── download/Downloader.kt   OkHttp/HttpURLConnection -> app files
```

---

## Phase 0 — Worktree & buildable skeleton

### Task 0.1: Create branch + sparse worktree

**Files:** none (git operations)

- [ ] **Step 1: Create the worktree without materializing media**

```bash
cd "C:/Mohsin/QuranAccademy/MFF/Marifatul-Quran"
git worktree add --no-checkout -b feature/android-native "C:/Mohsin/QuranAccademy/MFF/Marifatul-Quran-android" v4
cd "C:/Mohsin/QuranAccademy/MFF/Marifatul-Quran-android"
git sparse-checkout init --cone
# include only what the Android build needs: data.js (for generation) + repo metadata
git sparse-checkout set data.js
git checkout
```

- [ ] **Step 2: Verify the worktree is light (no audio/recordings)**

Run: `du -sh --exclude=.git .`
Expected: a few MB at most (NOT 1.4 GB). `ls` shows `data.js` but no `audio/` or recordings folder.

- [ ] **Step 3: Remove the heavy media from this branch's tree so future `git checkout` stays light**

```bash
git rm -r --cached --quiet audio "قرآن آڈیوز ریکارڈنگ" 2>/dev/null || true
git commit -m "chore(android): drop streamed media from native branch (served via Pages)" || true
```

Note: media remains intact on `v4` and on Pages; we only remove it from this branch.

### Task 0.2: Gradle skeleton that builds an empty app to a release APK

**Files:**
- Create: `settings.gradle`, `build.gradle`, `gradle.properties`, `local.properties`, `.gitignore`
- Create: `gradlew`, `gradlew.bat`, `gradle/wrapper/gradle-wrapper.properties`, `gradle/wrapper/gradle-wrapper.jar`
- Create: `app/build.gradle`, `app/proguard-rules.pro`, `app/src/main/AndroidManifest.xml`, `app/src/main/java/com/mohsingdp/marifatulquran/MainActivity.kt`
- Create: `core/build.gradle`, `core/src/main/kotlin/com/mohsingdp/marifatulquran/core/Ruku.kt`

**Interfaces:**
- Produces: a runnable Gradle project; `:core` consumable by `:app`; `MainActivity` launchable.

- [ ] **Step 1: Generate the Gradle wrapper pinned to 8.14.5**

```bash
# Use the already-downloaded Gradle from the spike (or any 8.14.5) to write the wrapper:
"<gradle-8.14.5>/bin/gradle" wrapper --gradle-version 8.14.5 --distribution-type bin
```
Expected: `gradlew`, `gradlew.bat`, `gradle/wrapper/*` created. Commit the wrapper jar (it is required for reproducible builds).

- [ ] **Step 2: Write `settings.gradle`**

```groovy
pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositories { google(); mavenCentral() }
}
rootProject.name = 'marifatul-quran'
include ':core'
include ':app'
```

- [ ] **Step 3: Write root `build.gradle`**

```groovy
plugins {
    id 'com.android.application' version '8.13.2' apply false
    id 'org.jetbrains.kotlin.android' version '2.2.20' apply false
    id 'org.jetbrains.kotlin.plugin.compose' version '2.2.20' apply false
    id 'org.jetbrains.kotlin.jvm' version '2.2.20' apply false
}
```

- [ ] **Step 4: Write `gradle.properties`, `local.properties`, `.gitignore`**

`gradle.properties`:
```properties
android.useAndroidX=true
android.nonTransitiveRClass=true
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m
org.gradle.workers.max=2
org.gradle.caching=true
kotlin.code.style=official
```
`local.properties` (gitignored):
```properties
sdk.dir=C:/Users/Mohsin/AppData/Local/Android/Sdk
```
`.gitignore`:
```
.gradle/
build/
local.properties
*.keystore
*.jks
keystore.properties
.idea/
```

- [ ] **Step 5: Write `core/build.gradle` (pure Kotlin JVM)**

```groovy
plugins {
    id 'org.jetbrains.kotlin.jvm'
    id 'java-library'
}
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
dependencies {
    testImplementation 'junit:junit:4.13.2'
}
```

- [ ] **Step 6: Write `core/.../Ruku.kt`**

```kotlin
package com.mohsingdp.marifatulquran.core

data class Ruku(
    val para: Int,
    val rukuInPara: String,
    val surah: String,
    val surahNumber: Int,
    val surahArabic: String,
    val verses: String,
    val audioUrl: String,
)
```

- [ ] **Step 7: Write `app/build.gradle`** (proven from spike; release config = size budget)

```groovy
plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
    id 'org.jetbrains.kotlin.plugin.compose'
}
android {
    namespace 'com.mohsingdp.marifatulquran'
    compileSdk 36
    defaultConfig {
        applicationId 'com.mohsingdp.marifatulquran'
        minSdk 26
        targetSdk 36
        versionCode 1
        versionName '1.0'
    }
    buildFeatures { compose true }
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    splits {
        abi {
            enable true
            reset()
            include 'arm64-v8a'
            universalApk false
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = '17' }
    lint { checkReleaseBuilds false; abortOnError false }
}
dependencies {
    implementation project(':core')
    def composeBom = platform('androidx.compose:compose-bom:2026.06.00')
    implementation composeBom
    implementation 'androidx.core:core-ktx:1.13.1'
    implementation 'androidx.activity:activity-compose:1.9.3'
    implementation 'androidx.compose.ui:ui'
    implementation 'androidx.compose.foundation:foundation'
    implementation 'androidx.compose.material3:material3'
    // Lean-by-default (budget): NO navigation-compose, material-icons-core, or lifecycle-viewmodel-compose.
    implementation 'androidx.datastore:datastore-preferences:1.1.1'
    implementation 'androidx.media3:media3-exoplayer:1.10.1'
    implementation 'androidx.media3:media3-session:1.10.1'
    implementation 'androidx.media3:media3-ui:1.10.1'
}
```

- [ ] **Step 8: Write `app/proguard-rules.pro`**

```proguard
# Rely on library-provided consumer rules (Compose, Media3). Add app keep rules here as needed.
```

- [ ] **Step 9: Write minimal `AndroidManifest.xml` and `MainActivity.kt`** (placeholder UI; replaced in Phase 3)

`AndroidManifest.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <application android:label="Marifatul Quran" android:allowBackup="false">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```
`MainActivity.kt`:
```kotlin
package com.mohsingdp.marifatulquran

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaterialTheme { Surface { Text("Marifatul Quran") } } }
    }
}
```

- [ ] **Step 10: Verify the whole thing builds to a release APK**

Run: `./gradlew :app:assembleRelease --no-daemon --console=plain`
Expected: `BUILD SUCCESSFUL`; APK at `app/build/outputs/apk/release/app-arm64-v8a-release-unsigned.apk`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore(android): gradle skeleton (core + app), builds release APK"
```

### Task 0.3: GATE — prove `.opus`/`.ogg` decode with stock media3 (NO extension)

**✅ ALREADY VERIFIED 2026-06-26 (PASSED).** Ran a throwaway media3 app on a headless API-36 emulator playing the real Pages `audio/1/1__R1__Al-Fatihah.opus` then `audio/2/2__R1__Al-Baqarah.ogg`. Result: both decoded by the platform's built-in **`c2.android.opus.decoder` (C2SoftOpusDec, 48000 Hz)** — the spike APK contained NO decoder `.so`. opus reached READY + isPlaying, played fully, auto-advanced to the ogg which allocated the same Opus decoder. No `PlaybackException`. (Both files are Opus-in-Ogg.) The platform Opus decoder is AOSP since API 21, so minSdk 26 is covered. Re-run this gate on a real API-26 device before release as a final belt-and-suspenders check, but the native-at-≤2 MB premise is CONFIRMED.

**Why it mattered:** the entire native premise + the 1.92 MB size rested on stock ExoPlayer decoding the audio without the FFmpeg/Opus extension `.so`. If it had failed, the extension `.so` would have broken the budget. It passed.

**Files:** temporary — a throwaway instrumented playback in `MainActivity` (revert after).

- [ ] **Step 1: Add media3 deps to `:app`** (already in Task 0.2) and temporarily make `MainActivity.onCreate` build an `ExoPlayer`, set two real Pages media items, and log state:

```kotlin
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
// inside onCreate, after super():
val p = ExoPlayer.Builder(this).build()
p.addListener(object : Player.Listener {
    override fun onPlaybackStateChanged(s: Int) { android.util.Log.i("DECODE", "state=$s") } // 3=READY,4=ENDED
    override fun onPlayerError(e: androidx.media3.common.PlaybackException) { android.util.Log.e("DECODE", "ERR ${e.errorCodeName}") }
})
p.setMediaItem(MediaItem.fromUri("https://mohsingdp-ai.github.io/Marifatul-Quran/audio/1/1__R1__Al-Fatihah.opus"))
p.addMediaItem(MediaItem.fromUri("https://mohsingdp-ai.github.io/Marifatul-Quran/audio/2/2__R1__Al-Baqarah.ogg"))
p.prepare(); p.playWhenReady = true
```

- [ ] **Step 2: Create/boot an API-26 emulator** (system-images are installed):

```bash
SDK="C:/Users/Mohsin/AppData/Local/Android/Sdk"
# list AVDs; if none for API 26, create one from an installed system-image, then:
"$SDK/emulator/emulator" -avd <api26_avd> -no-snapshot -no-boot-anim &
"$SDK/platform-tools/adb.exe" wait-for-device
```

- [ ] **Step 3: Install, run, read logcat**

```bash
./gradlew :app:installDebug --no-daemon
"$SDK/platform-tools/adb.exe" logcat -s DECODE:* -v time
```
Expected: `state=3` (READY) then `state=4` (ENDED) for BOTH files; NO `ERR` line. That proves opus + ogg decode on API 26 with stock media3.

- [ ] **Step 4: Decision gate**
  - PASS → revert the temporary `MainActivity` changes (`git checkout app/.../MainActivity.kt`), proceed to Phase 1.
  - FAIL with a decoder/extension error → STOP. The native-at-≤2 MB premise is broken; escalate to the user (options: accept the extension `.so` + larger APK, transcode audio to a format with a smaller decoder, or reconsider the TWA).

- [ ] **Step 5: Commit the (reverted) state** — only the gate result is recorded; no temp code lands. `git commit --allow-empty -m "test(android): decode gate passed (opus/ogg on API26, stock media3)"`

---

## Phase 1 — `:core` domain logic (strict TDD)

### Task 1.1: Audio URL builder with per-segment percent-encoding

**Files:**
- Create: `core/src/main/kotlin/com/mohsingdp/marifatulquran/core/AudioUrls.kt`
- Test: `core/src/test/kotlin/com/mohsingdp/marifatulquran/core/AudioUrlsTest.kt`

**Interfaces:**
- Produces: `const val PAGES_BASE: String`; `fun audioUrl(ruku: Ruku, base: String = PAGES_BASE): String`

- [ ] **Step 1: Write the failing test** (covers the space + apostrophe cases verified 200 on Pages)

```kotlin
package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertEquals
import org.junit.Test

class AudioUrlsTest {
    private fun ruku(url: String) = Ruku(3, "R9", "Ali 'Imran", 3, "آل عمران", "1–9", url)

    @Test fun plainFilenameIsAppended() {
        val r = Ruku(1, "R1", "Al-Fatihah", 1, "الفاتحة", "1–7", "audio/1/1__R1__Al-Fatihah.opus")
        assertEquals(
            "https://mohsingdp-ai.github.io/Marifatul-Quran/audio/1/1__R1__Al-Fatihah.opus",
            audioUrl(r)
        )
    }

    @Test fun spaceBecomesPercent20AndApostrophePercent27() {
        val r = ruku("audio/3/3__R9__Ali 'Imran.ogg")
        assertEquals(
            "https://mohsingdp-ai.github.io/Marifatul-Quran/audio/3/3__R9__Ali%20%27Imran.ogg",
            audioUrl(r)
        )
    }

    @Test fun slashesBetweenSegmentsAreNotEncoded() {
        val r = ruku("audio/6/6__R5__Al-Ma'idah.opus")
        assertEquals(
            "https://mohsingdp-ai.github.io/Marifatul-Quran/audio/6/6__R5__Al-Ma%27idah.opus",
            audioUrl(r)
        )
    }

    @Test fun trailingSlashOnBaseIsNotDoubled() {
        val r = Ruku(1, "R1", "X", 1, "x", "1", "audio/1/a.opus")
        assertEquals("https://x.test/audio/1/a.opus", audioUrl(r, "https://x.test/"))
        assertEquals("https://x.test/audio/1/a.opus", audioUrl(r, "https://x.test"))
    }
}
```

- [ ] **Step 2: Run it, verify it fails**

Run: `./gradlew :core:test --tests "*AudioUrlsTest" --no-daemon`
Expected: FAIL — `audioUrl` / `PAGES_BASE` unresolved.

- [ ] **Step 3: Implement minimally**

```kotlin
package com.mohsingdp.marifatulquran.core

import java.net.URLEncoder

const val PAGES_BASE = "https://mohsingdp-ai.github.io/Marifatul-Quran/"

/** Encode a single path segment for a URL: space -> %20, apostrophe -> %27, '/' preserved by caller. */
private fun encodeSegment(segment: String): String =
    URLEncoder.encode(segment, "UTF-8").replace("+", "%20")

fun audioUrl(ruku: Ruku, base: String = PAGES_BASE): String {
    val encodedRelative = ruku.audioUrl.split("/").joinToString("/") { encodeSegment(it) }
    return base.trimEnd('/') + "/" + encodedRelative
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `./gradlew :core:test --tests "*AudioUrlsTest" --no-daemon`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add core/
git commit -m "feat(core): audio URL builder with per-segment percent-encoding"
```

### Task 1.2: Generate `RukuData.kt` from `data.js`

**Files:**
- Create: `tools/generate-ruku-data.mjs`
- Create (generated): `core/src/main/kotlin/com/mohsingdp/marifatulquran/core/RukuData.kt`
- Test: `core/src/test/kotlin/com/mohsingdp/marifatulquran/core/RukuDataTest.kt`

**Interfaces:**
- Produces: `val ALL_RUKUS: List<Ruku>` (553 entries).

- [ ] **Step 1: Write the generator** `tools/generate-ruku-data.mjs`

```js
import fs from 'fs';
// data.js lives at the worktree root (sparse-checked-out).
const src = fs.readFileSync('data.js', 'utf8');
const arr = eval(src + '\nQURAN_DATA');
const k = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$') + '"';
const lines = arr.map(r =>
  `    Ruku(${r.para}, ${k(r.rukuInPara)}, ${k(r.surah)}, ${r.surahNumber}, ${k(r.surahArabic)}, ${k(r.verses)}, ${k(r.audioUrl)}),`
).join('\n');
const out = `package com.mohsingdp.marifatulquran.core

// GENERATED from data.js by tools/generate-ruku-data.mjs — do not edit by hand.
val ALL_RUKUS: List<Ruku> = listOf(
${lines}
)
`;
fs.writeFileSync('core/src/main/kotlin/com/mohsingdp/marifatulquran/core/RukuData.kt', out);
console.log('Wrote', arr.length, 'rukus');
```

- [ ] **Step 2: Run the generator**

Run: `node tools/generate-ruku-data.mjs`
Expected: `Wrote 553 rukus`; `RukuData.kt` created.

- [ ] **Step 3: Write the test** (guards count + a known first/last row + presence of tricky names)

```kotlin
package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RukuDataTest {
    @Test fun hasAll553Rukus() = assertEquals(553, ALL_RUKUS.size)

    @Test fun firstRukuIsAlFatihah() {
        val first = ALL_RUKUS.first()
        assertEquals(1, first.para)
        assertEquals("R1", first.rukuInPara)
        assertEquals("Al-Fatihah", first.surah)
        assertEquals("audio/1/1__R1__Al-Fatihah.opus", first.audioUrl)
    }

    @Test fun coversAll30Paras() {
        assertEquals((1..30).toSet(), ALL_RUKUS.map { it.para }.toSet())
    }

    @Test fun retainsApostropheNames() {
        assertTrue(ALL_RUKUS.any { it.audioUrl.contains("Ali 'Imran") })
    }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `./gradlew :core:test --tests "*RukuDataTest" --no-daemon`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/ core/
git commit -m "feat(core): generate ALL_RUKUS (553) from data.js"
```

### Task 1.3: Catalog grouping by para

**Files:**
- Create: `core/.../RukuCatalog.kt`
- Test: `core/.../RukuCatalogTest.kt`

**Interfaces:**
- Produces: `data class ParaGroup(val para: Int, val rukus: List<Ruku>)`; `fun groupByPara(rukus: List<Ruku> = ALL_RUKUS): List<ParaGroup>`

- [ ] **Step 1: Write the failing test**

```kotlin
package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertEquals
import org.junit.Test

class RukuCatalogTest {
    @Test fun groupsInto30ParasInOrder() {
        val groups = groupByPara()
        assertEquals(30, groups.size)
        assertEquals((1..30).toList(), groups.map { it.para })
    }

    @Test fun para1Has16Rukus() {
        assertEquals(16, groupByPara().first { it.para == 1 }.rukus.size)
    }

    @Test fun everyRukuInAGroupBelongsToThatPara() {
        groupByPara().forEach { g -> g.rukus.forEach { assertEquals(g.para, it.para) } }
    }
}
```

- [ ] **Step 2: Run it, verify it fails.** Run: `./gradlew :core:test --tests "*RukuCatalogTest" --no-daemon` — FAIL.

- [ ] **Step 3: Implement**

```kotlin
package com.mohsingdp.marifatulquran.core

data class ParaGroup(val para: Int, val rukus: List<Ruku>)

fun groupByPara(rukus: List<Ruku> = ALL_RUKUS): List<ParaGroup> =
    rukus.groupBy { it.para }
        .toSortedMap()
        .map { (para, items) -> ParaGroup(para, items) }
```

- [ ] **Step 4: Run, verify pass.** Expected: PASS (3 tests).

- [ ] **Step 5: Commit.** `git commit -am "feat(core): group rukus by para"`

### Task 1.4: Playlist / queue logic (next / previous / auto-advance)

**Files:**
- Create: `core/.../Playlist.kt`
- Test: `core/.../PlaylistTest.kt`

**Interfaces:**
- Produces: `class Playlist(val items: List<Ruku>, startIndex: Int = 0)` with `val current: Ruku`, `val index: Int`, `fun hasNext(): Boolean`, `fun hasPrevious(): Boolean`, `fun next(): Ruku?` (advances, null at end), `fun previous(): Ruku?`, `fun seekTo(i: Int): Ruku`.

- [ ] **Step 1: Write the failing test**

```kotlin
package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaylistTest {
    private val items = groupByPara().first { it.para == 1 }.rukus  // 16 rukus

    @Test fun startsAtGivenIndex() {
        val pl = Playlist(items, startIndex = 2)
        assertEquals(items[2], pl.current)
        assertEquals(2, pl.index)
    }

    @Test fun nextAdvancesAndReturnsNewCurrent() {
        val pl = Playlist(items, 0)
        assertEquals(items[1], pl.next())
        assertEquals(1, pl.index)
    }

    @Test fun nextAtEndReturnsNullAndDoesNotAdvance() {
        val pl = Playlist(items, items.lastIndex)
        assertFalse(pl.hasNext())
        assertNull(pl.next())
        assertEquals(items.lastIndex, pl.index)
    }

    @Test fun previousAtStartReturnsNull() {
        val pl = Playlist(items, 0)
        assertFalse(pl.hasPrevious())
        assertNull(pl.previous())
    }

    @Test fun seekToChangesCurrent() {
        val pl = Playlist(items, 0)
        assertEquals(items[5], pl.seekTo(5))
        assertTrue(pl.hasPrevious())
    }
}
```

- [ ] **Step 2: Run it, verify it fails.** FAIL.

- [ ] **Step 3: Implement**

```kotlin
package com.mohsingdp.marifatulquran.core

class Playlist(val items: List<Ruku>, startIndex: Int = 0) {
    init { require(items.isNotEmpty()) { "Playlist must not be empty" } }
    var index: Int = startIndex.coerceIn(0, items.lastIndex)
        private set
    val current: Ruku get() = items[index]
    fun hasNext(): Boolean = index < items.lastIndex
    fun hasPrevious(): Boolean = index > 0
    fun next(): Ruku? { if (!hasNext()) return null; index++; return current }
    fun previous(): Ruku? { if (!hasPrevious()) return null; index--; return current }
    fun seekTo(i: Int): Ruku { index = i.coerceIn(0, items.lastIndex); return current }
}
```

- [ ] **Step 4: Run, verify pass.** Expected: PASS (5 tests).

- [ ] **Step 5: Commit.** `git commit -am "feat(core): playlist queue with next/previous/seek"`

### Task 1.5: Download status model

**Files:**
- Create: `core/.../DownloadStatus.kt`
- Test: `core/.../DownloadStatusTest.kt`

**Interfaces:**
- Produces: `sealed interface DownloadStatus { object NotDownloaded; object Downloading; object Downloaded; data class Failed(val reason: String) }`; `fun isPlayableOffline(s: DownloadStatus): Boolean`

- [ ] **Step 1: Failing test**

```kotlin
package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DownloadStatusTest {
    @Test fun onlyDownloadedIsPlayableOffline() {
        assertTrue(isPlayableOffline(DownloadStatus.Downloaded))
        assertFalse(isPlayableOffline(DownloadStatus.NotDownloaded))
        assertFalse(isPlayableOffline(DownloadStatus.Downloading))
        assertFalse(isPlayableOffline(DownloadStatus.Failed("io")))
    }
}
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement**

```kotlin
package com.mohsingdp.marifatulquran.core

sealed interface DownloadStatus {
    data object NotDownloaded : DownloadStatus
    data object Downloading : DownloadStatus
    data object Downloaded : DownloadStatus
    data class Failed(val reason: String) : DownloadStatus
}

fun isPlayableOffline(s: DownloadStatus): Boolean = s is DownloadStatus.Downloaded
```

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Run the FULL core suite + commit**

Run: `./gradlew :core:test --no-daemon`
Expected: ALL core tests PASS.
```bash
git commit -am "feat(core): download status model"
```

---

## Phase 2 — `:app` theme (Material 3, brand tokens)

### Task 2.1: M3 color scheme from web brand tokens

**Files:**
- Create: `app/src/main/java/com/mohsingdp/marifatulquran/ui/theme/Theme.kt`
- Create: `app/src/main/java/com/mohsingdp/marifatulquran/ui/theme/Color.kt`

**Interfaces:**
- Produces: `@Composable fun MarifatulTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit)`

Brand tokens lifted verbatim from `style.css`: teal header `#0D5C5C`, teal accent `#0F7A7A`, teal dark `#0D4F4F`, gold `#8B6914` (light) / `#D4B85C` (dark), dark surfaces `#141C1C`/`#0A3D3D`, text `#1A1A1A` / `#E8F2F2`.

- [ ] **Step 1: Write `Color.kt`**

```kotlin
package com.mohsingdp.marifatulquran.ui.theme

import androidx.compose.ui.graphics.Color

val TealHeader = Color(0xFF0D5C5C)
val TealAccent = Color(0xFF0F7A7A)
val TealDark = Color(0xFF0D4F4F)
val GoldLight = Color(0xFF8B6914)
val GoldDark = Color(0xFFD4B85C)
val DarkSurface = Color(0xFF141C1C)
val DarkHeader = Color(0xFF0A3D3D)
val TextLight = Color(0xFF1A1A1A)
val TextDark = Color(0xFFE8F2F2)
```

- [ ] **Step 2: Write `Theme.kt`**

```kotlin
package com.mohsingdp.marifatulquran.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = TealAccent, onPrimary = Color(0xFFFFFFFF),
    secondary = GoldLight, background = Color(0xFFEEF4F4), onBackground = TextLight,
)
private val DarkColors = darkColorScheme(
    primary = TealAccent, secondary = GoldDark,
    background = DarkSurface, onBackground = TextDark, surface = DarkHeader,
)

@Composable
fun MarifatulTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (darkTheme) DarkColors else LightColors, content = content)
}
```
(Note: add `import androidx.compose.ui.graphics.Color` for the inline `Color(...)` calls.)

- [ ] **Step 3: Verify it compiles**

Run: `./gradlew :app:compileReleaseKotlin --no-daemon`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit.** `git commit -am "feat(app): Material 3 theme from brand tokens"`

---

## Phase 3 — Repository + Browse (ViewModel TDD with fakes, UI verified)

### Task 3.1: RukuRepository + BrowseViewModel (TDD with fake repo)

**Files:**
- Create: `app/.../data/RukuRepository.kt`
- Create: `app/.../ui/BrowseViewModel.kt`
- Test: `app/src/test/java/com/mohsingdp/marifatulquran/ui/BrowseViewModelTest.kt`

**Interfaces:**
- Produces: `interface RukuRepository { fun paras(): List<ParaGroup> }`; `class DefaultRukuRepository : RukuRepository` (delegates to `groupByPara()`); `class BrowseViewModel(repo: RukuRepository)` exposing `val paras: List<ParaGroup>` and `fun rukusFor(para: Int): List<Ruku>`.

- [ ] **Step 1: Add `testImplementation 'junit:junit:4.13.2'` to `app/build.gradle` dependencies.**

- [ ] **Step 2: Write the failing test (fake repo, no Android deps in VM)**

```kotlin
package com.mohsingdp.marifatulquran.ui

import com.mohsingdp.marifatulquran.core.ParaGroup
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.data.RukuRepository
import org.junit.Assert.assertEquals
import org.junit.Test

class BrowseViewModelTest {
    private val fake = object : RukuRepository {
        override fun paras() = listOf(
            ParaGroup(1, listOf(Ruku(1, "R1", "Al-Fatihah", 1, "الفاتحة", "1–7", "audio/1/1__R1__Al-Fatihah.opus"))),
            ParaGroup(2, listOf(Ruku(2, "R1", "Al-Baqarah", 2, "البقرة", "142–147", "audio/2/2__R1__Al-Baqarah.ogg"))),
        )
    }

    @Test fun exposesParasFromRepo() {
        assertEquals(listOf(1, 2), BrowseViewModel(fake).paras.map { it.para })
    }

    @Test fun rukusForReturnsThatParasRukus() {
        assertEquals(1, BrowseViewModel(fake).rukusFor(2).size)
        assertEquals("Al-Baqarah", BrowseViewModel(fake).rukusFor(2).first().surah)
    }
}
```

- [ ] **Step 3: Run, verify fail.** Run: `./gradlew :app:testReleaseUnitTest --tests "*BrowseViewModelTest" --no-daemon` — FAIL.

- [ ] **Step 4: Implement `RukuRepository.kt` and `BrowseViewModel.kt`**

```kotlin
// data/RukuRepository.kt
package com.mohsingdp.marifatulquran.data

import com.mohsingdp.marifatulquran.core.ParaGroup
import com.mohsingdp.marifatulquran.core.groupByPara

interface RukuRepository { fun paras(): List<ParaGroup> }

class DefaultRukuRepository : RukuRepository {
    override fun paras(): List<ParaGroup> = groupByPara()
}
```
```kotlin
// ui/BrowseViewModel.kt
package com.mohsingdp.marifatulquran.ui

import com.mohsingdp.marifatulquran.core.ParaGroup
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.data.RukuRepository

class BrowseViewModel(repo: RukuRepository) {
    val paras: List<ParaGroup> = repo.paras()
    fun rukusFor(para: Int): List<Ruku> = paras.firstOrNull { it.para == para }?.rukus ?: emptyList()
}
```

- [ ] **Step 5: Run, verify pass.** Expected: PASS (2 tests).

- [ ] **Step 6: Commit.** `git commit -am "feat(app): RukuRepository + BrowseViewModel (TDD)"`

### Task 3.2: Browse + Player Compose screens + lean nav (verified by build/on-device)

**Files:**
- Create: `app/.../ui/BrowseScreen.kt`, `app/.../ui/PlayerScreen.kt`
- Create: `app/src/main/res/drawable/ic_play.xml`, `ic_pause.xml` (vector — replaces material-icons-core)
- Modify: `app/.../MainActivity.kt`

**Interfaces:**
- Consumes: `BrowseViewModel`, `DefaultRukuRepository`, `audioUrl()`, `Playlist`.
- Produces: `@Composable fun BrowseScreen(vm, onOpen: (para: Int, index: Int) -> Unit)`, `@Composable fun PlayerScreen(...)`.

**Lean nav (no `navigation-compose`):** hold screen state in `MainActivity` with a sealed `Screen` and a `when`:
```kotlin
sealed interface Screen { data object Browse : Screen; data class Player(val para: Int, val index: Int) : Screen }
// in setContent { MarifatulTheme { var screen by remember { mutableStateOf<Screen>(Screen.Browse) }
//   when (val s = screen) { is Screen.Browse -> BrowseScreen(vm) { p, i -> screen = Screen.Player(p, i) }
//                           is Screen.Player -> PlayerScreen(s.para, s.index, onBack = { screen = Screen.Browse }) } } }
// Handle system back to pop Player -> Browse via BackHandler.
```

This is a "verify the edge" task (Compose UI). The list layout is lifted from the build-verified spike `RukuList`/`PlayerScreen` composables, retargeted to `ParaGroup`/`Ruku`, `MarifatulTheme`, and vector-drawable play/pause icons (`painterResource(R.drawable.ic_play)`).

- [ ] **Step 1: Write the two vector drawables** `ic_play.xml` / `ic_pause.xml` (standard Material play/pause paths) so we don't pull in `material-icons-core`.
- [ ] **Step 2: Write `BrowseScreen.kt`** — Scaffold + TopAppBar + LazyColumn over `vm.paras` → rukus; each row renders `surah` + `surahArabic` (system Arabic font) + `Para N · Rn · verses`; row click → `onOpen(para, indexWithinFullParaList)`.
- [ ] **Step 3: Write `PlayerScreen.kt`** — Scaffold + Slider + play/pause `IconButton(painterResource(...))` + speed chips. UI-only here; controller wired in Phase 5.
- [ ] **Step 4: Wire `MainActivity`** with the `when`-based `Screen` state + `BackHandler`, wrapped in `MarifatulTheme`.
- [ ] **Step 5: Verify build + launch**

Run: `./gradlew :app:assembleDebug --no-daemon` then install on emulator/device:
`& "$SDK\platform-tools\adb.exe" install -r app/build/outputs/apk/debug/app-arm64-v8a-debug.apk`
Expected: app launches, list scrolls through 30 paras / 553 rukus, tapping opens the player screen, back returns. Screenshot.

- [ ] **Step 6: Commit.** `git commit -am "feat(app): browse + player screens, lean when-based nav"`

---

## Phase 4 — Media3 background playback (service + lockscreen)

### Task 4.1: PlaybackService (MediaSessionService) + PlayerController

**Files:**
- Create: `app/.../playback/PlaybackService.kt` (proven from spike)
- Create: `app/.../playback/PlayerController.kt`
- Modify: `app/src/main/AndroidManifest.xml` (register service)

**Interfaces:**
- Produces: `class PlayerController(context)` with `fun setQueue(rukus: List<Ruku>, startIndex: Int)`, `fun play()`, `fun pause()`, `fun seekTo(ms: Long)`, `fun setSpeed(speed: Float)`, `val state: StateFlow<PlayerUiState>`; auto-advance handled by ExoPlayer queue (`setMediaItems`).

This is a "verify the edge" task. Decode is proven by Task 0.3 (stock media3, no extension `.so`). `MediaSessionService` provides the lockscreen/notification *plumbing*, but it is NOT free: a foreground-service notification is required, and Android 14+ enforces `FOREGROUND_SERVICE_MEDIA_PLAYBACK` + FGS-start timing rules. Treat the notification + FGS-start as explicit on-device verification, not a given.

- [ ] **Step 1: Write `PlaybackService.kt`** (the build-verified spike service):

```kotlin
package com.mohsingdp.marifatulquran.playback

import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

class PlaybackService : MediaSessionService() {
    private var session: MediaSession? = null
    override fun onCreate() {
        super.onCreate()
        val player = ExoPlayer.Builder(this).build()
        session = MediaSession.Builder(this, player).build()
    }
    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session
    override fun onDestroy() {
        session?.run { player.release(); release() }; session = null
        super.onDestroy()
    }
}
```

- [ ] **Step 2: Register the service in `AndroidManifest.xml`** (inside `<application>`):

```xml
<service
    android:name=".playback.PlaybackService"
    android:exported="true"
    android:foregroundServiceType="mediaPlayback">
    <intent-filter>
        <action android:name="androidx.media3.session.MediaSessionService" />
    </intent-filter>
</service>
```

- [ ] **Step 3: Write `PlayerController.kt`** — the trickiest integration; concrete code below. Connects a `MediaController` asynchronously, maps the `Ruku` queue to `MediaItem`s (local file if downloaded, else `audioUrl(ruku)`), exposes play/pause/seek/speed and a polled `StateFlow`.

```kotlin
package com.mohsingdp.marifatulquran.playback

import android.content.ComponentName
import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.core.audioUrl
import com.mohsingdp.marifatulquran.download.Downloader
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class PlayerUiState(
    val isPlaying: Boolean = false,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
    val currentIndex: Int = 0,
)

class PlayerController(
    context: Context,
    private val downloader: Downloader,
    private val scope: CoroutineScope,
) {
    private val _state = MutableStateFlow(PlayerUiState())
    val state: StateFlow<PlayerUiState> = _state
    private var controller: MediaController? = null

    init {
        val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        future.addListener({
            controller = future.get().also { c ->
                c.addListener(object : Player.Listener {
                    override fun onEvents(player: Player, events: Player.Events) = pushState()
                })
            }
            startPolling()
        }, MoreExecutors.directExecutor())
    }

    private fun mediaItemFor(r: Ruku): MediaItem {
        val local = downloader.localFile(r)
        val uri = if (local.exists()) local.toURI().toString() else audioUrl(r)
        return MediaItem.fromUri(uri)
    }

    fun setQueue(rukus: List<Ruku>, startIndex: Int) {
        val c = controller ?: return
        c.setMediaItems(rukus.map { mediaItemFor(it) }, startIndex, 0L)
        c.prepare()
    }
    fun play() { controller?.play() }
    fun pause() { controller?.pause() }
    fun seekTo(ms: Long) { controller?.seekTo(ms) }
    fun setSpeed(speed: Float) { controller?.setPlaybackSpeed(speed) }

    private fun startPolling() = scope.launch(Dispatchers.Main) {
        while (true) { pushState(); delay(500) }
    }
    private fun pushState() {
        val c = controller ?: return
        _state.value = PlayerUiState(
            isPlaying = c.isPlaying,
            positionMs = c.currentPosition.coerceAtLeast(0),
            durationMs = c.duration.coerceAtLeast(0),
            currentIndex = c.currentMediaItemIndex,
        )
    }
    fun release() { controller?.release(); controller = null }
}
```
Note: `media3-session` brings Guava (`MoreExecutors`) transitively. Auto-advance is the default ExoPlayer queue behavior once `setMediaItems` holds the para's rukus.

- [ ] **Step 4: Verify on device** — start playback of a ruku, background the app, confirm audio continues and lockscreen/notification controls appear and work (play/pause/seek/next). Auto-advance to next ruku at end-of-track.

- [ ] **Step 5: Commit.** `git commit -am "feat(app): Media3 background playback + lockscreen controls"`

---

## Phase 5 — Player wiring: speed, seek, auto-advance, resume

### Task 5.1: Resume position via DataStore

**Files:**
- Create: `app/.../data/Prefs.kt`
- Test: `app/src/test/java/.../PrefsLogicTest.kt` (test the pure key/format logic; DataStore IO verified on device)

**Interfaces:**
- Produces: `class Prefs(context)` with `suspend fun savePosition(para: Int, rukuIndex: Int, positionMs: Long)`, `suspend fun lastPosition(): SavedPosition?`; `data class SavedPosition(para, rukuIndex, positionMs)`; pure helper `fun positionKey(para: Int): String`.

- [ ] **Step 1: TDD the pure key helper**

```kotlin
// PrefsLogicTest.kt
import com.mohsingdp.marifatulquran.data.positionKey
import org.junit.Assert.assertEquals
import org.junit.Test
class PrefsLogicTest {
    @Test fun keyIsStablePerPara() { assertEquals("pos_para_3", positionKey(3)) }
}
```

- [ ] **Step 2: Run, fail. Step 3: Implement `positionKey` + DataStore-backed `Prefs`. Step 4: Run, pass.**

- [ ] **Step 5: Wire into PlayerScreen/PlayerController** — save position on pause/stop; on app open, offer "resume last".

- [ ] **Step 6: Verify on device** — play, close, reopen → resumes at saved ruku + position.

- [ ] **Step 7: Commit.** `git commit -am "feat(app): resume-last-position via DataStore"`

### Task 5.2: Speed control + seek + auto-advance UI

**Files:** Modify `app/.../ui/PlayerScreen.kt`, `app/.../playback/PlayerController.kt`

- [ ] **Step 1:** Bind the Slider to `state.positionMs`/`durationMs`; `onValueChangeFinished` → `controller.seekTo`.
- [ ] **Step 2:** Speed chips (0.75×/1×/1.25×/1.5×/2×) → `controller.setSpeed`.
- [ ] **Step 3:** Auto-advance is the ExoPlayer queue default; expose a "play whole para" entry that sets the para's rukus as the queue.
- [ ] **Step 4: Verify on device** — seek, speed change, and continuous para playback all work.
- [ ] **Step 5: Commit.** `git commit -am "feat(app): speed/seek/continuous-para playback"`

---

## Phase 6 — Offline download

### Task 6.1: Downloader + offline-first URL resolution

**Files:**
- Create: `app/.../download/Downloader.kt`
- Modify: `app/.../playback/PlayerController.kt` (prefer local file when downloaded)
- Test: `app/src/test/java/.../LocalPathTest.kt` (pure path logic)

**Interfaces:**
- Produces: `class Downloader(context)` with `suspend fun download(ruku): DownloadStatus`, `fun localFile(ruku): File`, `fun status(ruku): DownloadStatus`; pure helper `fun localFileName(ruku: Ruku): String` (e.g. `"${ruku.para}_${ruku.rukuInPara}_${ruku.surah}".replace nonsafe + extension`).

- [ ] **Step 1: TDD `localFileName`** (deterministic, filesystem-safe, preserves extension)

```kotlin
import com.mohsingdp.marifatulquran.download.localFileName
import com.mohsingdp.marifatulquran.core.Ruku
import org.junit.Assert.assertEquals
import org.junit.Test
class LocalPathTest {
    @Test fun safeNameKeepsExtension() {
        val r = Ruku(3, "R9", "Ali 'Imran", 3, "x", "1", "audio/3/3__R9__Ali 'Imran.ogg")
        assertEquals("3_R9.ogg", localFileName(r)) // para_ruku.ext — no spaces/apostrophes
    }
}
```

- [ ] **Step 2: Run fail. Step 3: Implement `localFileName` (`"${para}_${rukuInPara}.${ext}"`, ext from audioUrl) + `Downloader` (HttpURLConnection GET from `audioUrl(ruku)` → `filesDir/audio/`). Step 4: Run pass.**
- [ ] **Step 5:** In `PlayerController`, build `MediaItem` from `localFile(ruku)` when `status==Downloaded`, else from `audioUrl(ruku)`.
- [ ] **Step 6: Download UI** — per-ruku download icon, per-para "download all", show progress/state.
- [ ] **Step 7: Verify on device** — download a ruku, enable airplane mode, confirm it plays offline; non-downloaded rukus show as needing network.
- [ ] **Step 8: Commit.** `git commit -am "feat(app): offline download + offline-first playback"`

---

## Phase 7 — Release: size gate, signing, distribution

### Task 7.1: Release keystore + signing config

**Files:** Create `keystore.properties` (gitignored), modify `app/build.gradle`

- [ ] **Step 1: Generate a dedicated release keystore** (BACK IT UP — losing it blocks future updates):

```bash
"$JAVA_HOME/bin/keytool" -genkeypair -v -keystore marifatul-release.keystore \
  -alias marifatul -keyalg RSA -keysize 2048 -validity 10000
```
Store it OUTSIDE the repo; record path + passwords in `keystore.properties` (gitignored).

- [ ] **Step 2: Add `signingConfigs` to `app/build.gradle`** reading from `keystore.properties`; attach to `release`. (Guard with `if (file('../keystore.properties').exists())` so CI/clones without the keystore still build unsigned.)

- [ ] **Step 3: Build signed release**

Run: `./gradlew :app:assembleRelease --no-daemon`
Expected: `app-arm64-v8a-release.apk` (signed).

- [ ] **Step 4: Commit.** `git commit -am "build(app): release signing config (keystore gitignored)"`

### Task 7.2: APK size gate (HARD ≤ 2 MB)

**Files:** Create `tools/check-apk-size.ps1` (or a bash one-liner in CI notes)

- [ ] **Step 1: Measure**

```powershell
$apk = "app/build/outputs/apk/release/app-arm64-v8a-release.apk"
$mb = [math]::Round((Get-Item $apk).Length/1MB, 2)
if ($mb -gt 2.0) { Write-Error "APK $mb MB exceeds 2 MB budget"; exit 1 } else { "APK OK: $mb MB" }
```
Expected: `APK OK: <≤2.0> MB`. (Spike baseline 1.92 MB universal; arm64 split ≈ 1.90 MB.)

- [ ] **Step 2: If over budget**, in priority order: confirm R8 fullMode + shrinkResources on; confirm arm64-only split; drop any accidental `material-icons-extended`/heavy dep; as last resort surface the overage to the user (budget is theirs to relax).

- [ ] **Step 3: Commit.** `git commit -am "build: APK size gate (<=2MB)"`

### Task 7.3: Distribution — GitHub release + QR

**Files:** none (release ops) — documented in `README.md`

- [ ] **Step 1:** Create a GitHub release on the repo, attach `app-arm64-v8a-release.apk`.
- [ ] **Step 2:** Generate a QR pointing at the release asset URL; verify install on a clean device.
- [ ] **Step 3:** Note the package-id caveat in README: if the old TWA (`com.mohsingdp.marifatulquran`) is installed, it must be uninstalled first (different signing key).
- [ ] **Step 4: Commit.** `git commit -am "docs: release + sideload instructions"`

---

## Phase 8 — Final verification

### Task 8.1: Full on-device acceptance pass

- [ ] Browse all 30 paras / 553 rukus; Arabic renders (system Noto Naskh).
- [ ] Stream a ruku (cold) from Pages; verify a spaced/apostrophe filename (e.g. para 3 R9 `Ali 'Imran`) plays — proves URL encoding.
- [ ] Background playback continues; lockscreen + notification controls work; headset buttons work.
- [ ] Speed, seek, continuous-para auto-advance, resume-last-position.
- [ ] Download a ruku + a whole para; play offline in airplane mode.
- [ ] `./gradlew :core:test` all green; release APK ≤ 2 MB; install from the QR/release on a clean device.

---

## Self-Review notes (author)

- **Spec coverage:** size budget (Phase 7.2 + global), Compose+Media3 (skeleton/Phases 3–4), brand theme (2.1), browse+stream (3.x), background/lockscreen (4.1), speed/seek/auto-advance/resume (5.x), offline (6.1), Pages base + encoding (1.1), bundle data (1.2), distribution (7.3), worktree/branch (0.1) — all mapped. Excluded items listed in Global Constraints.
- **TDD boundary honored:** `:core` (1.x) and pure helpers (5.1, 6.1) are red→green→refactor; ViewModel (3.1) uses a fake repo; service/UI/DataStore-IO are "verify on device" per decision #9.
- **Type consistency:** `Ruku`, `ParaGroup`, `audioUrl(ruku, base)`, `Playlist`, `RukuRepository.paras()`, `BrowseViewModel.rukusFor()`, `DownloadStatus`, `localFileName(ruku)` used consistently across tasks.
- **Versions** all verified to exist (maven-metadata checks): Gradle 8.14.5, AGP 8.13.2, Kotlin 2.2.20, Compose BOM 2026.06.00, Media3 1.10.1.

---

## Phase 9 — Settings + playback mode (match web: Stop / Loop / Next)

Web parity (from app.js/index.html): Settings → "After ruku ends" tri-state stored in `playback_mode` (default `none`). On track end: `none`=stop, `loop`=repeat current, `next`=play next ruku.

### Task 9.1: `:core` PlaybackMode (TDD)
- `enum class PlaybackMode { NONE, LOOP, NEXT }`; `fun PlaybackMode.storageValue(): String` ("none"/"loop"/"next"); `fun parsePlaybackMode(s: String?): PlaybackMode` (loop→LOOP, next→NEXT, else NONE); `const val PLAYBACK_MODE_KEY = "playback_mode"`.
- Tests: parse("loop")==LOOP, parse("next")==NEXT, parse(null)/parse("x")==NONE; round-trip storageValue↔parse.

### Task 9.2: Prefs + Settings screen + nav + PlayerController wiring (verify on device/build)
- `Prefs`: `fun getPlaybackMode(): PlaybackMode` / `fun setPlaybackMode(m)` (SharedPreferences "mq", key PLAYBACK_MODE_KEY).
- `ui/SettingsScreen.kt`: Scaffold + TopAppBar("Settings") + "After ruku ends" segmented buttons **Stop / Loop / Next** (active = current), writing Prefs + calling `controller.applyPlaybackMode(m)`.
- Nav: add `Screen.Settings` to MainActivity sealed nav; a gear IconButton (vector `ic_settings.xml`) in BrowseScreen TopAppBar → Settings; BackHandler returns to Browse.
- `PlayerController.applyPlaybackMode(m)`: `setRepeatMode(if (m==LOOP) REPEAT_MODE_ONE else REPEAT_MODE_OFF)`; remember `m`; in the existing Player.Listener add `onMediaItemTransition(item, reason)` → if `reason == MEDIA_ITEM_TRANSITION_REASON_AUTO && m == NONE` then `pause()`. Apply current mode in `setQueue` and whenever Settings changes it. Default NONE (matches web — CHANGES prior always-advance behavior).

## Phase 10 — WhatsApp share (match web caption + deep link)

### Task 10.1: `:core` share text (TDD)
- `fun playerDeepLink(ruku: Ruku, base: String = PAGES_BASE): String` = `base.trimEnd('/') + "/player.html?para=" + ruku.para + "&ruku=" + formEncode(ruku.rukuInPara)` where formEncode = `URLEncoder.encode(value, "UTF-8")` (matches web URLSearchParams: space→`+`, `+`→`%2B`).
- `fun shareCaption(ruku: Ruku, base: String = PAGES_BASE): String` = `"P${ruku.para}: ${ruku.rukuInPara} — ${ruku.surah} (${ruku.verses})\n" + playerDeepLink(ruku, base)`.
- Tests: R1 → `.../player.html?para=1&ruku=R1`; a "+" ruku (e.g. "R16+") → `ruku=R16%2B`; caption line format exact.

### Task 10.2: Share button + intent (verify on device/build)
- Vector `ic_share.xml`. Share IconButton on each ruku row (and PlayerScreen). On click: `Intent(ACTION_SEND).setType("text/plain").putExtra(EXTRA_TEXT, shareCaption(ruku))`, try `setPackage("com.whatsapp")`; on `ActivityNotFoundException` fall back to `Intent.createChooser(...)`. (Matches web: shares ruku title + stable player.html link.)

**Budget:** both phases must keep release arm64 APK ≤ 2 MiB (currently 1.876, ~124KB headroom).
