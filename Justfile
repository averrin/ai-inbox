# Justfile for AI Inbox (Cross-platform)

# Platform detection
OS_FAMILY    := os_family()
IS_WINDOWS   := if OS_FAMILY == "windows" { "true" } else { "false" }

# Path and Command settings
PATH_SEP     := if IS_WINDOWS == "true" { ";" } else { ":" }
CMD_SEP      := if IS_WINDOWS == "true" { ";" } else { " && " }
GRADLEW      := if IS_WINDOWS == "true" { ".\\gradlew.bat" } else { "./gradlew" }
export ANDROID_HOME := if IS_WINDOWS == "true" { "C:/Users/o/AppData/Local/Android/Sdk" } else { "/home/averrin/Android/Sdk" }

# Shell configuration
set windows-shell := ["powershell.exe", "-ExecutionPolicy", "Bypass", "-Command"]
set shell := ["sh", "-cu"]


# Environment setup

export PATH := ANDROID_HOME + "/platform-tools" + PATH_SEP + ANDROID_HOME + "/cmdline-tools/latest/bin" + PATH_SEP + env_var('PATH')

# List available commands
default:
    @just --list

# Build and install release APK
build-release:
    @echo "Building Release APK..."
    cd android{{ CMD_SEP }}{{ GRADLEW }} assembleRelease
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
