## 1. State & Logic

- [x] 1.1 Update `EventTypesConfig` interface and `useEventTypesStore` to include `lunchConfig` (targetCalendarId, defaultInvitee).
- [x] 1.2 Create `useLunchSuggestion` hook (or `services/lunchService` utility) to implement the prioritized detection logic:
    - [x] 1.2.1 Search for 60m free gaps.
    - [x] 1.2.2 Search for gaps in "Skippable" events (if distinguishable).
    - [x] 1.2.3 Search for gaps in "Movable" events (with +1 penalty).
    - [x] 1.2.4 Fallback to "Missed Lunch" (with +2 penalty).
- [x] 1.3 Ensure `calculateEventDifficulty` respects the penalties from lunch detection.

## 2. UI Components

- [x] 2.1 Update `ScheduleEvent.tsx` to handle `type: 'generated'` and `typeTag: 'LUNCH_SUGGESTION'` with specific styling (transparent background, dashed border).
- [x] 2.2 Create `LunchContextModal.tsx` component:
    - [x] 2.2.1 Time picker for adjusting the ephemeral slot.
    - [x] 2.2.2 "Materialize" button.
    - [x] 2.2.3 "Save" button (for session updates).
- [x] 2.3 Create `LunchSettings.tsx` (or update `EventTypesSettings.tsx`) to allow configuring the target calendar and invitee.

## 3. Integration

- [x] 3.1 Integrate `useLunchSuggestion` into `ScheduleScreen.tsx` to generate the ephemeral event.
- [x] 3.2 Wire up `ScheduleEvent` onPress to open `LunchContextModal` for lunch suggestion events.
- [x] 3.3 Implement "Materialize" action in `LunchContextModal` using `calendarService.createEvent` and `lunchConfig`.
- [x] 3.4 Add Lunch Settings entry point in the Settings screen.

## 4. Verification

- [x] 4.1 Verify `useLunchSuggestion` logic (via UI observation or unit test attempt).
- [x] 4.2 Verify UI rendering (Lunch event style, modal appearance).
- [x] 4.3 Verify Materialization (Event creation).
