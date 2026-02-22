# Walkthrough - Smart Lunch Implementation

I have implemented the "Smart Lunch" feature, which intelligently suggests lunch breaks based on user's schedule constraints and allows materializing them into actual events.

## Changes

### 1. State Management
- **`EventTypeConfig` Update**: Added `lunchConfig` to store `targetCalendarId` and `defaultInvitee`.
- **`useEventTypesStore`**: Added actions to update and persist `lunchConfig`.

### 2. Logic & Detection
- **`useLunchSuggestion` Hook**: Created a new hook that:
    - Finds the "Lunch" time range.
    - Scans for 60-minute slots.
    - Prioritizes Free Time (Tier 1).
    - Falls back to Skippable Events (Tier 2).
    - Falls back to Movable Events (Tier 3, +1 Penalty).
    - Defaults to "Missed Lunch" (Marker, +2 Penalty) if no slot found.
- **`ScheduleScreen` Integration**: Integrated the hook to merge ephemeral lunch events into the calendar view and update the daily score with penalties.

### 3. UI Components
- **`ScheduleEvent`**: Updated to render `LUNCH_SUGGESTION` events with:
    - Low opacity background (20%).
    - Dashed border.
    - `generated` type styling.
- **`LunchContextModal`**: Created a modal to:
    - Adjust start/end time of the suggested lunch.
    - "Materialize" the lunch into a real calendar event.
    - Fallback to generic "Save" (close).
- **`LunchSettings`**: Created a settings panel to:
    - Select the Target Calendar for materialized lunch events.
    - Set a Default Invitee.
- **`SetupScreen`**: Added an entry point for "Lunch Settings" in the main settings menu.

### 4. Integration
- Wired up `ScheduleScreen` to open `LunchContextModal` when clicking a lunch suggestion.
- Updated `calendarService` to support `createCalendarEvent`.

## Verification Results

### Automated Checks
- **Lint Check**: Fixed syntax error in `SetupScreen.tsx`.
- **Type Check**: Fixed `selectedEvent` type definition in `ScheduleScreen.tsx`.

### Manual Verification Steps
1. **Detection**:
    - Ensure a "Lunch" time range exists in settings.
    - Function verifies that a dashed green event appears in the optimal slot.
    - Verify that overlapping movable events causes the lunch to be placed over them with a +1 difficulty penalty to the day.
2. **Interaction**:
    - Tapping the dashed lunch event opens the `LunchContextModal`.
    - Tapping "Materialize" creates a real event in the selected calendar.
    - The ephemeral event should disappear (replaced by real event) on next refresh.
3. **Configuration**:
    - "Lunch Settings" in the Settings menu allows selecting a specific calendar.

## Screenshots
(No screenshots available as this is a code-only implementation session)
