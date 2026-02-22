## Why

Currently, the system only supports a single "Default Calendar" setting. Users often have different needs for where new events should be created versus which calendar's version of a merged event they want to interact with (e.g., they might want to create work events in a specific work calendar but prefer to "open" events in their primary personal calendar if a duplicate exists).

## What Changes

- **Multiple Default settings**: Replace the single "Default Calendar" with two specific settings:
  - **Default for Create**: Specifies which calendar new events are added to by default.
  - **Default for Open**: Specifies which calendar event should be "active" (used for opening, editing, and property retention) when multiple identical events are merged.
- **Enhanced Merging Logic**: When merging duplicate events, the system will now check if any of the duplicates belong to the "Default for Open" calendar and prioritize that one.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `calendar-configuration`: Update settings to include separate "Default for Create" and "Default for Open" selections.
- `calendar-event-merging`: Update merging logic to respect the "Default for Open" preference when selecting the primary event from a set of duplicates.

## Impact

- **Settings UI**: `CalendarSelector.tsx` and related settings screens.
- **Calendar Logic**: `calendarService.ts` and `mergeEvents` utility in `ScheduleScreen.tsx` or related hooks.
- **Store**: `settings.ts` store to accommodate new configuration keys.
