## 1. Reminder Drag and Drop

- [x] 1.1 Research touch handling in `CalendarBody` / `ScheduleScreen` to determine best injection point for `PanGestureHandler`.
- [x] 1.2 Implement `DraggableEventWrapper` component that handles long-press and drag gestures.
- [x] 1.3 Wrap Reminder events in `DraggableEventWrapper` within `CalendarBody` (or `CalendarZone`).
- [x] 1.4 Implement "magnetic snap" visual feedback (ghost element) during drag.
- [x] 1.5 Implement drop handler to calculate new time based on Y coordinate and 15-minute grid.
- [x] 1.6 Connect drop handler to `reminderService.updateReminder` to persist changes.
- [x] 1.7 Implement optimistic update of the events state in `ScheduleScreen` on drop.
- [x] 1.8 Implement optimistic snap-to-target in `DraggableEventWrapper` (avoid jump back).

## 2. Event Context GCal Link

- [x] 2.1 Update `EventContextModal.tsx` props to accept event source details (or ensure `event` object has deep link/source ID).
- [x] 2.2 Add "Open in Google Calendar" button to the modal UI.
- [x] 2.3 Implement conditional rendering: Button visible ONLY if `event.source.name` includes "Google" or similar identifier.
- [x] 2.4 Implement `handleOpenGCal` function using `Linking.openURL`.
- [x] 2.5 Test fallback mechanism (open calendar app if deep link fails).
- [x] 2.6 Improve deep link targeting (open specific event by ID).

## 3. Verification

- [x] 3.1 Verify drag-and-drop works smoothly without locking up the scroll view unexpectedly.
- [x] 3.2 Verify reminder time is updated after restart/refresh (persistence).
- [x] 3.3 Verify "Open in Google Calendar" button appears for GCal events.
- [x] 3.4 Verify "Open in Google Calendar" button opens the external app.
