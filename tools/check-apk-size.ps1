# Size gate: fails if the arm64 release APK exceeds the 2 MB hard budget.
$ErrorActionPreference = "Stop"
$base = Split-Path -Parent $PSScriptRoot
$candidates = @(
  "$base\app\build\outputs\apk\release\app-arm64-v8a-release.apk",
  "$base\app\build\outputs\apk\release\app-arm64-v8a-release-unsigned.apk"
)
$apk = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $apk) { Write-Error "No release APK found. Run: ./gradlew :app:assembleRelease"; exit 1 }
$bytes = (Get-Item $apk).Length
$mib = [math]::Round($bytes / 1MB, 3)
$limit = 2 * 1MB  # 2,097,152 bytes
if ($bytes -gt $limit) {
  Write-Error ("APK {0} = {1} MiB EXCEEDS the 2 MB budget ({2} bytes > {3})." -f (Split-Path -Leaf $apk), $mib, $bytes, $limit)
  exit 1
} else {
  Write-Host ("OK: {0} = {1} MiB (<= 2 MB), {2} bytes" -f (Split-Path -Leaf $apk), $mib, $bytes)
}
