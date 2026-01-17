# Fix UX Gaps

## Goal
Address user-reported usability issues regarding linking, content summarization, navigation, and folder selection.

## Problem
1.  **Linking:** Deep links to Obsidian often fail silently or when the file is not yet verified.
2.  **Summarization:** Users cannot choose between "Full Content" and "Summary". URL processing defaults to full content now, but a toggle is safer.
3.  **Navigation:** "Cancel" button in manual mode does not exit the app as expected.
4.  **Config Access:** The settings button is missing or hard to find.
5.  **Folder Selection:** No way to browse existing folders; user must type.
6.  **Folder Validation:** Only runs on click, should be reactive.

## Solution

### 1. Robust Linking
*   Verify file existence (using `checkDirectoryExists` or `getInfoAsync` replacement) before attempting `Linking.openURL`.
*   Add explicit Alerts if opening fails.

### 2. Content Toggle
*   Add a "Full Content" switch in the UI.
*   Default: ON for URLs, OFF for text (or user preference).
*   Pass this flag to the Gemini service to adjust the prompt dynamically.

### 3. Navigation
*   `onReset` in manual mode (Home component) should call `BackHandler.exitApp()` if there is no share intent to return to.

### 4. Config Button
*   Ensure `onOpenSettings` is valid and the button is rendered in the Header.

### 5. Folder Selection
*   Add a "Select" button.
*   Opens a modal listing subdirectories of the current `vaultUri` (using `readDirectoryAsync`).
*   User taps a folder to fill the input.

### 6. Reactive Validation
*   Use `useEffect` to trigger folder check whenever `folder` input changes (debounced).

## Risks
*   **SAF Performance:** Listing many folders might be slow.
*   **Prompt Complexity:** Dynamic prompts need careful testing to ensure Gemini respects the "No Summary" instruction.
