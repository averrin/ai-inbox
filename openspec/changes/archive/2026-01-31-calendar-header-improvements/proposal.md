## Why

The current calendar header only displays the selected date, which provides limited context and navigation options. Users need a date ruler to see surrounding days and better controls (swipe, buttons) to navigate quickly between dates.

## What Changes

- **Date Ruler**: Replace single date display with a date ruler (e.g., showing a week or scrollable list of days).
- **Swipe Navigation**: Allow swiping left/right in the header to change dates/weeks.
- **Buttons**: Add Next and Previous arrows for explicit navigation.

## Capabilities

### New Capabilities
- `schedule-navigation`: Controls and UI for navigating the calendar timeline (date ruler, swipe, buttons).

### Modified Capabilities
<!-- None, no existing specs -->

## Impact

- `components/screens/ScheduleScreen.tsx`: Major updates to the header section.
- New components likely for `DateRuler` or `CalendarHeader`.
