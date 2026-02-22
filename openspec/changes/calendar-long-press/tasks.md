## 1. Research & Interface

- [x] 1.1 Analyze `CalendarBody` coordinate mapping to determine time from touch position
- [x] 1.2 Define `onQuickAction` callback in `CalendarContainerProps` and propagate to `CalendarBody`

## 2. Gesture & Marker Implementation

- [x] 2.1 Wrap `CalendarBody` rows in a `GestureDetector` with `Gesture.Pan()`
- [x] 2.2 Create `QuickEntryMarker` animated component using Reanimated shared values
- [x] 2.3 Implement snapping logic (15-min intervals) in the gesture handler
- [x] 2.4 Trigger haptic feedback on gesture activation

## 3. Action Menu

- [x] 3.1 Implement `QuickActionMenu` component with "Add Event" and "Add Reminder" buttons
- [x] 3.2 Position action menu relative to the final marker coordinates
- [x] 3.3 Implement click-outside-to-cancel logic for the menu

## 4. Screen Integration

- [x] 4.1 Implement `handleQuickAction` in `ScheduleScreen.tsx`
- [x] 4.2 Link action menu buttons to existing `ScheduleScreen` state for opening modals
- [x] 4.3 Verify time pre-filling in both Event and Reminder modals
