## Context

The current `ScheduleScreen` displays events and reminders but only allows editing via a modal. Rescheduling requires multiple taps. Users want a more direct manipulation method (drag and drop). Also, users syncing with Google Calendar lack a quick way to jump to the source event.

## Goals / Non-Goals

**Goals:**
- Implement long-press to drag reminders to new time slots.
- Provide visual feedback during drag (opacity, snapping).
- Update reminder time persistence on drop.
- Add "Open in Google Calendar" button to `EventContextModal` for relevant events.

**Non-Goals:**
- Rescheduling "Events" (read-only or complicated bi-sync). We focus on *Reminders* (created in-app) for now, although the request said "reschedule existing reminders".
- Resizing duration via drag (handles) - this is strictly moving start time.

## Decisions

### Gesture Handling
- **Decision**: Use `PanGestureHandler` from `react-native-gesture-handler` with `activateAfterLongPress` (or manual long-press state activation) for the draggable markers.
- **Rationale**: Prevents accidental drags while scrolling the calendar.
- **Implementation**: The `CalendarMarker` (or reminder view) will be wrapped. On active drag, we compute the time slot based on Y position and snap to 15-minute increments.

### Visual Feedback
- **Decision**: The dragged element will "lift" (scale/shadow) and follow the finger. A "ghost" or the element itself will snap to the nearest slot to show where it will land.
- **Rationale**: Clear affordance of the action and precise target indication.

### Google Calendar Link
- **Decision**: Attempt to use `event.source.name === 'Google'` (or similar check) to show the button. We will try to open the `event.url` if available via `expo-calendar`.
- **Fallback**: If deep link is not available, we won't show the button or will open top-level GCal. `expo-calendar` events usually don't carry the web link cleanly unless synced specifically. We will check `event.description` or other fields, or simply rely on `Linking.openURL('content://com.android.calendar/time/...')` (Android) or `calshow:` (iOS) if specific event linking is hard.
- **Refinement**: If the user specifically wants *Google Calendar* app, we can try `https://www.google.com/calendar/render...` but that requires web usage. We will stick to `Linking` to available URL or fallback.

## Risks / Trade-offs

- **Gesture Conflict**: Dragging inside a `ScrollView` can be tricky. We need to disable the scroll view (or partial lock) while dragging.
- **GCal Deep Link**: Native calendar events might not map 1:1 to a simple URL. We might only be able to open the native calendar app at the event's time.

