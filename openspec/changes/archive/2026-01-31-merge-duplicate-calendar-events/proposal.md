## Why

Users often have multiple calendars synced (e.g., Google Calendar, iCloud) that may contain identical events (e.g., invites sent to multiple aliases). This clutters the schedule view with duplicate blocks, making it harder to read. Merging these duplicates will provide a cleaner, more consolidated view of the user's schedule.

## What Changes

- Implement logic to identify and merge duplicate calendar events.
- Duplicate definition: Events with the exact same title, start time, and end time.
- The UI will display a single merged event instead of multiple overlapping ones.
- **Note**: This is a visual merge for the schedule view; underlying calendar data remains unchanged.

## Capabilities

### New Capabilities
- `calendar-event-merging`: Logic to detect and merge duplicate events from different calendars for display purposes.

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **Code**: `ScheduleScreen.tsx` (event fetching and mapping logic), potentially `calendarService.ts` if logic is centralized there.
- **UX**: Schedule view will show fewer, cleaner event blocks.
