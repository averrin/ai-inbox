#!/bin/bash
set -e

# Adb path can be set via env or assumed in PATH
ADB=${ADB_PATH:-adb}

$ADB shell screencap -p /sdcard/screenshot.png
$ADB pull /sdcard/screenshot.png
echo "Screenshot saved to $(pwd)/screenshot.png"
