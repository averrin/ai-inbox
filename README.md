# AI Inbox Mobile Client

An aesthetic Android receiver application that processes shared content using Google Gemini and saves it as formatted markdown to your Obsidian vault.

## Features
- **Share Target**: Accepts text and URLs from any Android app.
- **AI Processing**: Uses Gemini 1.5 Flash to generate titles, tags, summaries, and frontmatter.
- **Obsidian Sync**: Saves directly to a user-selected folder (Vault) using Scoped Storage and opens the note in Obsidian.
- **Premium UI**: Glassmorphism design with animated interactions.

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Locally**
   ```bash
   npx expo start --android
   ```

## Build

### GitHub Actions
This repository includes a workflow (`.github/workflows/android-build.yml`) that automatically builds an APK on every push to main.
Download the artifact from the Actions tab.

### Local Build
To build an APK locally without EAS:

```bash
# 1. Generate Native Project
npx expo prebuild --platform android

# 2. Build APK
cd android
./gradlew assembleDebug
```

The APK will be located at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Configuration
- **Gemini API Key**: Required on first launch.
- **Vault Location**: Select your Obsidian vault folder when prompted.
