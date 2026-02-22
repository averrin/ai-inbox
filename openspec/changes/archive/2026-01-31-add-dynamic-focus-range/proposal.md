## Why

Users need visual feedback to identify periods of intense focus work on their calendar. Currently, it's difficult to spot when multiple difficult events are clustered together without breaks, making it hard to plan recovery time or manage cognitive load.

## What Changes

- Add automatic detection of "focus time" periods where non-zero difficulty events are clustered with minimal gaps
- Display a bright red dynamic time range overlay when focus periods are detected
- Calculate focus period from first event start to last event end when total duration exceeds threshold

## Capabilities

### New Capabilities
- `dynamic-focus-range`: Automatically detects and displays focus time periods based on event difficulty, gaps between events, and total duration

### Modified Capabilities
<!-- No existing capabilities being modified -->

## Impact

- **Components**: `ScheduleScreen.tsx` will need to calculate and pass dynamic focus ranges to the calendar
- **UI**: `CalendarBody.tsx` will render dynamic ranges alongside user-defined ranges
- **Event Model**: Need access to event difficulty property
- **Performance**: Focus range calculation will run on each calendar data change
