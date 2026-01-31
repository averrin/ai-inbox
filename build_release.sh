#!/bin/bash
set -e

export PATH=$PATH:/home/averrin/Android/Sdk/platform-tools
PROJECT_ROOT=$(pwd)
ANDROID_DIR="$PROJECT_ROOT/android"

if [ ! -d "$ANDROID_DIR" ]; then
    echo "Error: android directory not found at $ANDROID_DIR"
    exit 1
fi

echo "Building Release APK..."
cd "$ANDROID_DIR"
./gradlew assembleRelease

echo "Installing APK..."
cd "$PROJECT_ROOT"
# Adjust path according to standard Expo/Android output
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"

if [ -f "$APK_PATH" ]; then
    adb install -r "$APK_PATH"
else
    echo "Error: APK not found at $APK_PATH"
    exit 1
fi

echo "Done!"
