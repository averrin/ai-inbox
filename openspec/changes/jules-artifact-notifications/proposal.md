# Proposal: Jules Artifact Notifications

Implement high-priority (DND-bypassing) notifications for Android/iOS when a new GitHub artifact is ready from a Jules-initiated PR.

## Problem Statement
Jules sessions generate PRs and subsequent GitHub Actions runs that produce artifacts (e.g., APKs). Currently, users must manually refresh or check the Jules screen to see if these are ready. There is no proactive alert when a build completes.

## Proposed Solution
- Monitor GitHub workflow run status for Jules-related PRs.
- Trigger a local or push notification when a run completes successfully and artifacts are available.
- Ensure the notification uses a high-priority channel that can bypass Do Not Disturb (DND) settings, similar to how the app handles critical reminders.

## Impact
- **Services**: `jules.ts` will need logic to poll or receive webhooks/triggers for completion.
- **UI**: Add notification permission handling and settings if needed.
- **Background**: Requires a background task or push notification listener.
