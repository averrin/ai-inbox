## Why

Users want to visually categorize their calendar events (e.g., "Work", "Personal", "Focus Time") with custom colors and labels. While some calendar providers support colors, users often want a unified, client-side type system that overrides or enhances the provider's data, especially for defining "types" across different calendars. This helps in quickly scanning the schedule and understanding time allocation.

## What Changes

- **Event Type Management**: Users can create, edit, and delete event types.
- **Event Type Properties**: Each type has a Title and a Color.
- **Assignment**: Users can assign a type to an event series.
- **Visuals**: Events with an assigned type will display with the type's color and a small tag/label in the UI.
- **Persistence**: Types and assignments are stored locally on the device.

## Capabilities

### New Capabilities
- `event-types`: Define and manage custom event types (title, color).
- `event-type-assignment`: Assign types to event series and apply visual overrides.

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **Settings Store**: Need to store `EventTypes` and `EventAssignments`.
- **UI**: `ScheduleScreen` needs to look up types and override event styles.
- **UI**: New settings screen for managing types.
- **UI**: Interaction to assign a type to an event (e.g., long press or detail view).
