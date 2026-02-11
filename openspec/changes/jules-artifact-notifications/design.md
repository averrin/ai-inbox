# Design: Jules Artifact Notifications

Technical design for implementing high-priority notifications when Jules-related GitHub artifacts are ready.

## User Experience
- User starts a Jules session.
- App monitors the status of the related PR/Workflow Run.
- When the run completes successfully, a notification is triggered.
- **Notification**: "Jules Artifact Ready: <title>. Click to download."
- **Priority**: High (visible alert with sound).

## Architecture

### Notification Service
- Use `expo-notifications` for managing local alerts.
- Configure a specific `NotificationChannel` on Android with `importance: AndroidImportance.MAX`.
- For iOS, request `allowCriticalAlerts` permission if feasible, otherwise standard high-priority alert.

### Background Monitoring
- **Option A (Foreground Polling)**: The `JulesScreen` continues polling while the app is active. Simplest, but doesn't handle backgrounded app.
- **Option B (Background Fetch / TaskManager)**: Use `expo-background-fetch` and `expo-task-manager` to poll the GitHub API every 15 minutes.
- **Option C (Remote Push Notifications)**: requires server-side infrastructure. Not preferred unless strictly necessary.

**Selected Approach**: **Option B**. We will register a background task that checks for "pending" Jules sessions and their associated GitHub runs.

### State Changes
- `store/settings.ts`: Add `notificationsEnabled` and `criticalAlertsEnabled` flags.
- `services/jules.ts`: Add `checkRunCompletion` utility.

## Implementation Details
1. **Permission Handling**: Add logic to `SetupScreen` or a new prompt to request notification permissions.
2. **Channel Setup**: Initialize the "Artifact Alerts" channel on app startup.
3. **Task Registration**: Register `CHECK_JULES_ARTIFACTS` task in `_layout.tsx`.
4. **Trigger Logic**: If `workflow_run.status === 'completed'` and `conclusion === 'success'`, trigger `Notifications.scheduleNotificationAsync`.

## Risks / Trade-offs
- **Polling Frequency**: Background fetch is limited to ~15 min intervals on iOS.
- **Battery Impact**: Polling background tasks can consume battery if not managed.
- **Notification Visibility**: We will use standard high-priority channels to ensure the user is alerted promptly. Global DND bypass is already handled at the app level.
