# Justfile for AI Inbox
# Environment setup

export ANDROID_HOME := "/home/averrin/Android/Sdk"
export PATH := ANDROID_HOME + "/platform-tools:" + ANDROID_HOME + "/cmdline-tools/latest/bin:" + env_var('PATH')

# List available commands
default:
    @just --list

# Build and install release APK
build-release:
    @echo "Building Release APK..."
    cd android && ./gradlew assembleRelease
    @echo "Installing APK..."
    adb install -r android/app/build/outputs/apk/release/app-release.apk
    @echo "Done!"

# Run the app on Android using Expo
run:
    npx expo run:android

# Take a screenshot from the connected device
screenshot:
    adb shell screencap -p /sdcard/screenshot.png
    adb pull /sdcard/screenshot.png
    @echo "Screenshot saved to ./screenshot.png"

connect:
    scrcpy -w --max-fps=30 --max-size=1280 --video-bit-rate=8M 

merge branch:
    git fetch
    opencode run "merge branch {{ branch }} and resolve conflicts. consider its Github PR for context"

updateBranch branch:
    git fetch
    opencode run "merge master into {{ branch }} and resolve conflicts"
