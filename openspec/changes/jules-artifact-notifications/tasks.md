# Tasks: Jules Artifact Notifications

Implementation checklist for jules-artifact-notifications.

## 1. Foundation & Permissions
- [x] 1.1 Install `expo-notifications`, `expo-background-fetch`, and `expo-task-manager`
- [x] 1.2 Implement notification permission request logic in `SetupScreen.tsx`
- [x] 1.3 Configure high-priority notification channel for Android in `_layout.tsx`

## 2. Background Task Implementation
- [x] 2.1 Define `CHECK_JULES_ARTIFACTS` task in `services/jules.ts`
- [x] 2.2 Register background fetch task in app entry point (`_layout.tsx`)
- [x] 2.3 Implement logic to track notified Run IDs using `AsyncStorage`

## 3. Monitoring Logic
- [x] 3.1 Implement run status check in the background task for all active Jules sessions
- [x] 3.2 Add logic to identify new successful runs with available artifacts
- [x] 3.3 Trigger local notification with maximum importance/priority

## 4. UI & Polish
- [x] 4.1 Update settings to allow toggling notifications
- [x] 4.2 Add visual confirmation in `JulesScreen` that notifications are active
- [x] 4.3 Verify notification sound and visibility on completion (Implementation verified)
