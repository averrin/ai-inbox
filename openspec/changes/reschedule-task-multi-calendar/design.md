## Context

Tasks in AI Inbox can be linked to multiple calendar events (e.g., a "Sync" task blocking time on both personal Google and work O365 calendars). This linkage is stored in the task's `event_id` property as a comma-separated list of IDs. 

Currently, `TodaysTasksPanel.tsx`'s `executeReschedule` function only processes the first ID in this list. While `ScheduleScreen.tsx` correctly handles multiple IDs when dragging events, the task panel actions ("Later", "Tomorrow") result in partial updates, leaving stale events on other calendars.

## Goals / Non-Goals

**Goals:**
- Ensure all linked calendar events are updated when a task is rescheduled via the "Later" or "Tomorrow" actions in `TodaysTasksPanel`.
- Maintain parity between the task panel and the calendar view's rescheduling logic.

**Non-Goals:**
- Changing the underlying storage format for linked events.
- Implementing complex conflict resolution if one calendar update fails while others succeed (best-effort update).

## Decisions

### 1. Multi-ID parsing in `TodaysTasksPanel.tsx`
The logic in `executeReschedule` will be refactored to:
- Split the `event_id` property by commas and trim results.
- Iterate over the resulting array of IDs.
- Call `updateCalendarEvent` for each ID using `Promise.all` for better responsiveness, though we will catch errors individually.

### 2. Standardize Update Loop
The loop pattern found in `ScheduleScreen.tsx` (lines 1200+) will be used as a reference to ensure consistency in how master IDs and instance start dates are handled during updates.

## Risks / Trade-offs

- **API Rate Limits**: Rapidly updating multiple events across different accounts might occasionally hit rate limits or trigger throttles in native calendar bridges, but for typical 2-3 calendar setups, this is unlikely.
- **Partial Failure**: If one calendar update fails (e.g., due to revoked permissions), the task and other calendar events will still move. This is considered acceptable compared to blocking all updates.
