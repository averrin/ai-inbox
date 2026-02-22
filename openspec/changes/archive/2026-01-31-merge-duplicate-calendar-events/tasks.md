## 1. Core Logic

- [x] 1.1 Create `services/calendarUtils.ts` (or add to `calendarService.ts` if appropriate) and implement `mergeDuplicateEvents` function.
- [x] 1.2 Write unit tests for `mergeDuplicateEvents` to verify merging logic (same title, start, end).

## 2. Service Integration

- [x] 2.1 Update `getCalendarEvents` in `services/calendarService.ts` to call `mergeDuplicateEvents` before returning.
- [x] 2.2 Verify that `ScheduleScreen` receives merged events correctly.

## 3. Cleanup

- [x] 3.1 Verify no regression in event displaying (colors, times).
