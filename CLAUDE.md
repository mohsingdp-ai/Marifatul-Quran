# Marifatul Quran — Native Android App

Native Kotlin + Jetpack Compose + Media3 app. Modules: `:core` (pure-Kotlin JVM, TDD) and `:app` (Compose/Media3). Audio streams from GitHub Pages. Package: `com.mohsingdp.marifatulquran`.

## Build environment

- **JDK:** `C:\Mohsin\Softwares\Jdk\amazon-corretto-17\jdk17.0.13_11` (set `JAVA_HOME` to this)
- **Android SDK / adb:** `C:/Users/Mohsin/AppData/Local/Android/Sdk` (`platform-tools/adb.exe`)
- Build with the Gradle wrapper from this directory: `.\gradlew.bat`

## Build the debug APK

```powershell
$env:JAVA_HOME = "C:\Mohsin\Softwares\Jdk\amazon-corretto-17\jdk17.0.13_11"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat clean assembleDebug --console=plain
```

- Output (arm64 only, ABI split): `app\build\outputs\apk\debug\app-arm64-v8a-debug.apk`
- **Always `clean` before a build you intend to ship/install.** Incremental builds here have produced a *stale* APK that Gradle reported as "up-to-date" — verify the APK's `LastWriteTime` is newer than the latest commit before installing.

## Install via WiFi (wireless) debugging — preferred

USB on this machine is unreliable (the phone's USB interface drops into a Windows "Error" state mid-session). **Use wireless debugging instead** — it needs no USB at all (so the old `adb tcpip` method, which requires a working USB first, won't help here).

Target device: Galaxy A33 5G (SM-A336E), arm64. Phone and PC must be on the **same WiFi** (PC WiFi has been `192.168.18.x`).

**One-time per phone reboot — pair (Android 11+ pairing-code flow):**
1. Phone: Settings → Developer options → **Wireless debugging** → ON.
2. Tap **"Pair device with pairing code"** → note the **IP:port** and **6-digit code** shown.
3. `adb pair <IP>:<PAIR_PORT> <CODE>` — e.g. `adb pair 192.168.18.62:39197 980166`
   - The 6-digit code can be passed as the 2nd arg (no interactive prompt).

**Connect + install (the connect port differs from the pairing port):**
4. On the *main* Wireless debugging screen, note **"IP address & Port"** (different port than pairing).
5. `adb connect <IP>:<CONNECT_PORT>` — e.g. `adb connect 192.168.18.62:41479`
6. `adb -s <IP>:<CONNECT_PORT> install -r -d app\build\outputs\apk\debug\app-arm64-v8a-debug.apk`
7. Launch: `adb -s <IP>:<CONNECT_PORT> shell monkey -p com.mohsingdp.marifatulquran -c android.intent.category.LAUNCHER 1`

The connection survives until the phone reboots or WiFi drops. To reconnect later you usually only re-run step 5 (the port may change) — **re-pairing is rarely needed**.

## Troubleshooting

- `adb devices` empty but Windows sees `SAMSUNG Mobile USB Composite Device`: USB debugging not authorized / wrong USB mode. **Prefer WiFi (above).**
- Device shows `offline`/`unauthorized`: `adb kill-server; adb start-server`, then accept the **"Allow USB debugging?"** prompt on the phone (tick *Always allow*).
- Device PnP status **"Error"**: failing cable/port — replug into a direct port or swap the cable. Don't fight it; switch to WiFi.
- Full APK install both ways uses `install -r -d` (reinstall, allow downgrade).

> Notes: the small **release** APK (`app-...-release-unsigned.apk`, ~2MB) is **unsigned** — can't be installed until signed; use the debug APK for quick installs. Playback needs internet (streams from GitHub Pages); offline download is available in-app.
