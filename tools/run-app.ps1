# run-app.ps1 — build, boot the emulator, install, and launch Marifatul Quran.
#
# Usage (from the project root):
#   pwsh tools/run-app.ps1              # build debug APK, boot emulator (windowed), install, launch
#   pwsh tools/run-app.ps1 -SkipBuild  # skip the build; install/launch the existing debug APK
#   pwsh tools/run-app.ps1 -Headless   # boot without a window (for screenshots over adb)
#
# Notes / gotchas baked in:
#   * Uses the hand-crafted AVD 'mq_test' (this machine has no avdmanager/cmdline-tools).
#   * NEVER passes -no-audio (it causes ERROR_CODE_AUDIO_TRACK_INIT_FAILED → no playback).
#   * Grants POST_NOTIFICATIONS so the media/lockscreen notification shows on API 33+.
#   * Audio streams from GitHub Pages, so the emulator needs network on to play.

param(
    [switch]$SkipBuild,
    [switch]$Headless
)
$ErrorActionPreference = "Stop"

# --- config (env overrides win; otherwise this machine's known-good paths) ---
$Sdk      = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { "C:\Users\Mohsin\AppData\Local\Android\Sdk" }
$JavaHome = if ($env:JAVA_HOME)        { $env:JAVA_HOME }        else { "C:\Mohsin\Softwares\Jdk\amazon-corretto-17\jdk17.0.13_11" }
$env:JAVA_HOME = $JavaHome
$env:ANDROID_SDK_ROOT = $Sdk
$env:ANDROID_HOME = $Sdk

$Adb      = "$Sdk\platform-tools\adb.exe"
$Emulator = "$Sdk\emulator\emulator.exe"
$Avd      = "mq_test"
$Pkg      = "com.mohsingdp.marifatulquran"
$ProjRoot = Split-Path -Parent $PSScriptRoot           # tools\ -> project root
$Apk      = "$ProjRoot\app\build\outputs\apk\debug\app-arm64-v8a-debug.apk"

function Get-LiveEmulator {
    (& $Adb devices) -split "`r?`n" |
        Where-Object { $_ -match '^(emulator-\d+)\s+device$' } |
        ForEach-Object { ($_ -split '\s+')[0] } |
        Select-Object -First 1
}

# --- 1. build (unless skipped) ---
if (-not $SkipBuild) {
    Write-Host "[1/4] Building debug APK (first run downloads Gradle, be patient)..." -ForegroundColor Cyan
    & "$ProjRoot\gradlew.bat" -p $ProjRoot ":app:assembleDebug" --no-daemon --console=plain
    if ($LASTEXITCODE -ne 0) { throw "Gradle build failed." }
}
if (-not (Test-Path $Apk)) { throw "APK not found: $Apk  (run without -SkipBuild first)." }

# --- 2. ensure an emulator is running ---
$ser = Get-LiveEmulator
if (-not $ser) {
    $avds = & $Emulator -list-avds
    if ($avds -notcontains $Avd) {
        throw "AVD '$Avd' not found. Available: [$($avds -join ', ')]. Create it in Android Studio (Device Manager) or via avdmanager."
    }
    Write-Host "[2/4] Booting emulator '$Avd'..." -ForegroundColor Cyan
    $emuArgs = @("-avd", $Avd, "-gpu", "auto", "-no-snapshot", "-no-boot-anim")
    if ($Headless) { $emuArgs += "-no-window" }    # window hidden, but audio stays ON
    Start-Process -FilePath $Emulator -ArgumentList $emuArgs
} else {
    Write-Host "[2/4] Reusing running emulator $ser." -ForegroundColor Cyan
}

# --- 3. wait for full boot ---
Write-Host "[3/4] Waiting for boot to complete..." -ForegroundColor Cyan
while (-not ($ser = Get-LiveEmulator)) { Start-Sleep 2 }
do { Start-Sleep 2; $booted = (& $Adb -s $ser shell getprop sys.boot_completed) -replace '\s','' } until ($booted -eq "1")

# --- 4. install + grant + launch ---
Write-Host "[4/4] Installing & launching on $ser..." -ForegroundColor Cyan
& $Adb -s $ser install -r $Apk
try { & $Adb -s $ser shell pm grant $Pkg android.permission.POST_NOTIFICATIONS } catch {}
& $Adb -s $ser shell am start -n "$Pkg/.MainActivity" | Out-Null
Write-Host "Done. Marifatul Quran is running on $ser — see the emulator window." -ForegroundColor Green
