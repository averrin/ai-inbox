# Refine UX and Configuration

## Goal
Improve the user experience by ensuring full content capture, robust deep linking, and accessible configuration, while adding support for Obsidian Iconize.

## Problem
1.  **Deep Linking:** Obsidian often fails to open the generated file, and lack of logging makes debugging difficult.
2.  **Content Truncation:** The current prompt requests a summary, but the user wants the full content saved.
3.  **Broken Navigation:** The "Cancel" button on the "Take Note" screen is non-functional.
4.  **Inaccessible Settings:** Once setup is complete, there is no UI to modify settings (API key, prompt, etc.).
5.  **Missing Features:**
    *   No support for `icon` frontmatter (Obsidian Iconize).
    *   Folder selection is manual and error-prone without validation.

## Solution

### 1. Full Content Capture
*   **Modify Default Prompt:** instructions to return the full markdown content in the `body` field, or a comprehensive rewrite, rather than a summary.

### 2. Obsidian Deep Linking
*   **Enhanced Logging:** Log the exact URI being attempted.
*   **Error Handling:** Catch and display linking errors explicitly.

### 3. UI/UX Improvements
*   **Cancel Button:** Ensure `onReset` correctly resets the state to allow new input or exit.
*   **Settings Access:** Add a "Settings" (gear) icon to the `ProcessingScreen` or `HistoryScreen` that re-opens the `SetupScreen` or a modal.
*   **Folder Selection:**
    *   Add a "Select" button next to the Folder input.
    *   Use `StorageAccessFramework` to pick a folder and derive the relative path if possible, or simple directory existence check if typing manually.
    *   Visual indicator (Green/Red check) if the folder exists.

### 4. Frontmatter
*   **Icon Support:** Add an `icon` field to `ProcessedNote` and mapping it to the YAML frontmatter.

## Risks
*   **Prompt Tokens:** Requesting full content might increase token usage/latency.
*   **SAF Complexity:** Deriving relative paths from SAF permissions can be tricky if the user picks a folder outside the root. We might need to restrict selection or just validate existence.
