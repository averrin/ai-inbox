## Why

The current settings structure is nested and inefficient. "Schedule" settings are clumped together, and valuable settings are hidden behind a generic "Tools" category. To improve usability and access speed, we need to flatten the settings hierarchy and provide dedicated screens for distinct configuration areas like Calendars and Event Types.

## What Changes

- **Flatten Hierarchy**: Remove the "Tools" settings screen. All categories previously within Tools will move to the root Settings screen.
- **Split Schedule Settings**: Instead of a single "Schedule" entry, separate it into two distinct root-level settings:
    - "Calendars"
    - "Event Types"
- **Navigation**: Update the root Settings list to include these new direct entry points.

## Capabilities

### New Capabilities
- `calendar-configuration`: Configuration specifically for connected calendars and their behaviors.
- `event-type-configuration`: Configuration for defined event types (colors, durations, etc.).

### Modified Capabilities
- `schedule-configuration`: **REMOVED** (Replaced by the two capabilities above).
- `settings-navigation`: The structure of the main settings area.

## Impact

- `SettingsScreen`: Major structural update.
- `ToolsSettingsScreen`: **Delete**.
- `ScheduleSettings`: Split into `CalendarsSettings` and `EventTypesSettings`.
