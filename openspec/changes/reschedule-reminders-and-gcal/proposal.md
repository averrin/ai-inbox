## Why

Users need a more intutitive way to reschedule reminders directly on the calendar interface without opening a modal. Drag-and-drop is a standard and expected interaction for this. Additionally, users need a quick way to view the source event in their external calendar app (Google Calendar) for full context or advanced editing.

## What Changes

- **Drag-and-Drop Rescheduling**: Long-pressing a reminder on the schedule view will allow dragging it to a new time slot.
- **Google Calendar Deep Link**: The Event Context Modal will include an "Open in Google Calendar" button for events synced from Google Calendar.

## Capabilities

### New Capabilities
- `reminder-management`: Interaction models for managing reminders on the schedule, specifically drag-and-drop rescheduling.
- `event-context-actions`: Actions available within the context of a selected event, specifically opening external calendar links.

### Modified Capabilities
<!-- No existing specs require modification of their core requirements. -->

## Impact

- **Components**: `ScheduleScreen`, `CalendarMarker` (or reminder component equivalent), `EventContextModal`.
- **Services**: `reminderService` (update time), `calendarService` (helper for GCal URL if needed, though likely available on event object).
- **Libraries**: `react-native-gesture-handler` for drag interactions.
