## Why

Users often link a single task to multiple calendar events (e.g., blocking time on both personal and work calendars) to ensure visibility and prevent overlap across different accounts. Currently, when a task is rescheduled (e.g., "Later" or "Tomorrow" actions), the system only updates the first event ID it finds. This results in desynchronization, leaving duplicate events in the old time slot on other calendars.

## What Changes

The rescheduling logic in the task panel and schedule view will be updated to support multi-event synchronization. When a task with multiple linked `event_id` entries is moved, the system will iterate through all associated IDs and apply the same time update to each one.

## Capabilities

### New Capabilities
- `multi-calendar-sync-reschedule`: Logic to synchronize time updates across multiple linked calendar events when a parent task is rescheduled.

### Modified Capabilities
- `calendar-event-merging`: The requirement for merging events should be extended to ensure that operations (like rescheduling) on a merged event or its parent task are propagated to all merged instances.

## Impact

- `TodaysTasksPanel.tsx`: Update `executeReschedule` to loop over all IDs in `event_id`.
- `ScheduleScreen.tsx`: Update `handleEventDrop` and other event manipulation handlers to propagate changes to all linked/merged IDs.
- `calendarService.ts`: Verify that sequential updates to different calendar IDs work correctly.
