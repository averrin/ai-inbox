## 1. Preparation

- [ ] 1.1 Verify `components/ui/calendar/interfaces.ts` supports `type: 'marker'` in `ICalendarEventBase`
- [ ] 1.2 Verify `components/ui/calendar` components render markers correctly (check for `CalendarMarker` component)

## 2. Schedule Screen Implementation

- [ ] 2.1 Subscribe to `useRemindersStore` in `ScheduleScreen.tsx` to get active reminders
- [ ] 2.2 Implement `useMemo` logic to filter reminders with due dates and map them to `ICalendarEventBase` objects (type: 'marker')
- [ ] 2.3 Merge mapped reminders with the main `events` array passed to `BigCalendar`
- [ ] 2.4 Update `onPressEvent` handler to check for `event.type === 'marker'`
- [ ] 2.5 Add `ReminderModal` (edit mode) triggering logic when a marker is pressed; standard events continue to open context menu
