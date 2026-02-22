## 1. Core Logic & State

- [x] 1.1 Create `TimeRange` and `TimeRangeDefinition` interfaces in a new types file (or `interfaces.ts`).
- [x] 1.2 Implement `useTimeRangeStore` using Zustand with persistence, including actions for create, update, delete, and toggle.
- [x] 1.3 Create `useTimeRangeEvents` hook that transforms definitions + date range into calendar events (zones).
- [x] 1.4 Write unit tests for `useTimeRangeEvents` (recurrence logic).

## 2. UI Components

- [x] 2.1 Create `TimeRangeForm` component (title input, time pickers, day selector, color picker).
- [x] 2.2 Create `TimeRangeItem` component for the list view.
- [x] 2.3 Create `TimeRangesScreen` (or Modal) that lists existing ranges and allows adding new ones via the Form.

## 3. Integration

- [x] 3.1 Integrate `useTimeRangeEvents` into `ScheduleScreen`, merging the resulting zone events with the main events array passed to `CalendarBody`.
- [x] 3.2 Add a navigation entry point (e.g. in Settings or a header button) to open the `TimeRangesScreen`.

## 4. Verification

- [ ] 4.1 Verify visually that ranges appear on correct days.
- [ ] 4.2 Verify persistence (reload app).
- [ ] 4.3 Verify adding/editing/deleting updates the view immediately.
