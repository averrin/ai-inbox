## 1. Implementation Logic

- [x] 1.1 Implement focus range detection helper function in `ScheduleScreen.tsx` that identifies clusters of qualifying events (difficulty > 0, gap <= 15m, duration > 60m)
- [x] 1.2 Update `ScheduleScreen` to calculate focus ranges when events change and transform them into `TimeRange` objects with `color: '#FF0000'`
- [x] 1.3 Verify that focus ranges are correctly detected for overlapping events and sequential events with small gaps
- [x] 1.4 Ensure single-day analysis by splitting ranges at midnight or clamping to day boundaries if necessary

## 2. Integration & Rendering

- [x] 2.1 Pass generated focus ranges to `CalendarBody` via `ranges` prop (verify existing prop usage doesn't need modification)
- [x] 2.2 Verify that `CalendarRange` correctly renders the red focus ranges alongside user-defined ranges
- [x] 2.3 Verify visual overlapping behavior (new offsets logic should handle this automatically)

## 3. Verification

- [x] 3.1 Verify scenario: Multiple events with small gaps create a range
- [x] 3.2 Verify scenario: Events with large gaps (>15m) do not create a range
- [x] 3.3 Verify scenario: Short total duration (<60m) does not create a range
- [x] 3.4 Verify scenario: Zero difficulty events are ignored
