## Why

Currently, adding an event or a reminder requires navigating to settings or using separate entry points, which can be slow and lacks visual context of the schedule. This change introduces a more intuitive, "direct-on-calendar" interaction.

## What Changes

- **Long-Press Detection**: The calendar surface will respond to a long-press gesture.
- **Dynamic Time Marker**: A visual bar/marker will appear under the user's finger during a long-press, snapping to time slots.
- **Drag-to-Adjust**: While holding the long-press, the user can drag the marker to select a specific time slot.
- **Quick Action Menu**: Upon release, a floating menu will appear with "Add Reminder" and "Add Event" buttons.
- **Pre-filled Modals**: Selecting an action will open the corresponding creation modal with the selected time pre-filled.

## Capabilities

### New Capabilities
- `calendar-quick-entry`: Handles gesture detection on the calendar grid, visual feedback for time selection, and the action menu for creating new items.

### Modified Capabilities
- (None)

## Impact

- `CalendarBody`: Needs to handle long-press and drag gestures.
- `ScheduleScreen`: Needs to coordinate the selection UI and modal opening.
- New `TimeSelectionMarker` UI component.
