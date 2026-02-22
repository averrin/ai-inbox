## Why

Users need visual cues to identify "free time" or recovery periods in their schedule. Highlighting gaps of more than 60 minutes where no difficult work is scheduled helps users plan downtime or shallow work effectively.

## What Changes

- Add automatic detection of "Free Time" zones based on gaps between difficult events.
- Criteria: Duration > 60 minutes containing no events with difficulty >= 1.
- Display these periods as pale green, striped zones on the calendar.
- Use the existing `zone` rendering capability in `CalendarBody`.

## Capabilities

### New Capabilities
- `free-time-detection`: Logic to identify and visualize periods free of high-difficulty events.

### Modified Capabilities
<!-- No modified capabilities -->

## Impact

- **Components**: `ScheduleScreen.tsx` (detection logic), `CalendarZone.tsx` (styling).
- **UI**: Visual addition of green striped zones to the calendar view.
- **Data Flow**: Generated zones passed to `CalendarBody` event stream.
