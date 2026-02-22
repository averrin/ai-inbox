## Context

The current `ScheduleScreen` fetches events from all selected local calendars and displays them directly. Users with synced calendars (e.g., Google Calendar synced to iOS Calendar) often see duplicate events for the same meeting, resulting in a cluttered view.

## Goals / Non-Goals

**Goals:**
- Filter out duplicate events based on title, start time, and end time.
- Display a single event block for duplicates.
- abstract the merging logic into a reusable function.

**Non-Goals:**
- modifying the actual calendar data on the device.
- complex merging logic (e.g., fuzzy matching titles).
- merging events with different times or durations.

## Decisions

### 1. Merging Logic Location
**Decision:** Implement the merging logic in `services/calendarService.ts` as a post-processing step in `getCalendarEvents` (or a wrapper function).
**Rationale:** Keeps the UI component (`ScheduleScreen`) clean and focused on rendering. Allows reusability if other components need to fetch events.

### 2. Identity Criteria
**Decision:** Events are considered duplicates if they have strict equality on: `title`, `startDate` (as ISO string or timestamp), and `endDate`.
**Rationale:** Simple and predictable. Fuzzy matching risks hiding distinct events that happen to look similar.

### 3. Merged Event Properties
**Decision:** The resulting merged event will take the properties (color, id, calendarId) of the *first* event encountered in the list.
**Rationale:** The primary goal is visual de-cluttering. Trying to represent "multiple calendars" in one block (e.g., striped colors) adds significant UI complexity for the MVP.

## Risks / Trade-offs

- **Risk:** Two different events actually have the same name and time (e.g., "Meeting" at 9 AM).
  - **Mitigation:** This is rare for a single user, but possible. Strict matching on title reduces this risk compared to fuzzy matching. The user would likely see them as the same commitment anyway.
- **Risk:** Performance impact on large lists of events.
  - **Mitigation:** The number of events per week is generally small (dozens, not thousands). A simple O(N^2) or O(N log N) deduplication is negligible.

## Migration Plan

No data migration required. This is a client-side display logic change.
