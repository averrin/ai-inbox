#!/bin/bash
set -e

export ADB_PATH="/home/averrin/Android/Sdk/platform-tools/adb"

# Adb path can be set via env or assumed in PATH
ADB=${ADB_PATH:-adb}

$ADB shell screencap -p /sdcard/screenshot.png
$ADB pull /sdcard/screenshot.png
echo "Screenshot saved to $(pwd)/screenshot.png"
