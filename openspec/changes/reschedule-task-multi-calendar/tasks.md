## 1. Multi-ID Rescheduling in TodaysTasksPanel

- [x] 1.1 Modify `executeReschedule` in `components/screens/TodaysTasksPanel.tsx` to parse multiple event IDs.
- [x] 1.2 Use `Promise.allSettled` (or individual try-catches in a map) to update all linked calendar events in `executeReschedule`.
- [x] 1.3 Ensure `taskToReschedule.properties.event_id` is split by commas and filtered to avoid empty strings.

## 2. ScheduleScreen Robustness

- [x] 2.1 Audit `handleEventDrop` in `components/screens/ScheduleScreen.tsx` to confirm it handles master IDs correctly for each linked event ID in a series.
- [x] 2.2 Audit `handleToggleCompleted` in `ScheduleScreen.tsx` (line 1259) to ensure it correctly identifies the "live" task when multiple events are merged.

## 3. Testing and Validation

- [x] 3.1 Verify rescheduling a task with dual links moves both events on the native calendar.
- [x] 3.2 Verify rescheduling a task with dual links updates the task date in the source markdown file.
- [x] 3.3 Verify that failure to update one calendar (e.g. read-only) does not prevent updating the other linked calendars or the task itself.
