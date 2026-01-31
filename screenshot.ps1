$ErrorActionPreference = "Stop"

$projectRoot = "C:\Users\o\Documents\GitHub\ai-time"
$adbPath = "C:\Users\o\AppData\Local\Android\Sdk\platform-tools\adb.exe"

& $adbPath shell screencap -p /sdcard/screenshot.png
& $adbPath pull /sdcard/screenshot.png

