## Why

Currently, reminders are siloed in their own list view and invisible on the main schedule. This makes planning difficult as users can't see time-sensitive tasks alongside their appointments. Visualizing reminders directly on the calendar as "markers" will provide a unified view of the day's commitments.

## What Changes

- **Fetch Reminders**: Update `ScheduleScreen` to fetch active reminders.
- **Map to Markers**: Convert reminder data into the calendar's "marker" format (added in `customize-calendar-view`).
- **Interaction**: Enable clicking on a reminder marker to open the `ReminderModal` for editing.

## Capabilities

### New Capabilities
- `reminder-visualization`: Displaying reminders on the calendar timeline.

### Modified Capabilities
- `calendar-interaction`: Handling clicks on non-standard event types (markers).

## Impact

- `ScheduleScreen`
- `ReminderModal` integration
