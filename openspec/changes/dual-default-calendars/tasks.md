## 1. Store & Models

- [x] 1.1 Update `SettingsState` in `store/settings.ts` to include `defaultCreateCalendarId` and `defaultOpenCalendarId`
- [x] 1.2 Implement migration logic in `useSettingsStore` to initialize new keys from legacy `defaultCalendarId`

## 2. Core Logic Enhancements

- [x] 2.1 Update `mergeDuplicateEvents` in `services/calendarUtils.ts` to accept a `priorityCalendarId`
- [x] 2.2 Update `getCalendarEvents` in `services/calendarService.ts` to pass the user's `defaultOpenCalendarId` to the merge utility
- [x] 2.3 Update `handleCreateEvent` in `ScheduleScreen.tsx` to respect `defaultCreateCalendarId`

## 3. Settings UI Updates

- [x] 3.1 Update `CalendarsSettings.tsx` to replace single-star selection with dual-icon selection (Create vs. Open)
- [x] 3.2 Add tooltips or descriptive text to `CalendarsSettings.tsx` to explain the dual default settings

## 4. Verification

- [x] 4.1 Verify that new events are created in the "Default for Create" calendar
- [x] 4.2 Verify that merged events prioritize the "Default for Open" calendar for display and interaction
