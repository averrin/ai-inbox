## Context

We are refactoring the settings navigation to be flatter and more explicit. Currently, settings are nested (Settings -> Tools -> Schedule). We want to expose "Calendars" and "Event Types" directly on the root Settings screen and remove the intermediate "Tools" screen.

## Goals / Non-Goals

**Goals:**
- Eliminate the "Tools" settings grouping.
- Create specific, dedicated screens for "Calendars" and "Event Types".
- Place "Calendars" and "Event Types" as top-level items in the main Settings list.
- Maintain all existing functionality from the schedule settings, just reorganized.

**Non-Goals:**
- Changing the actual logic of how calendars or event types work (just configuration UI).

## Decisions

### 1. Navigation Flattening
We will remove the `ToolsRoute` (or equivalent) from the settings navigator. Its children will be promoted to the root settings list.

### 2. Splitting Schedule Logic
The existing `ScheduleSettings` component (or the logic intended for it) will be split into two pure components:
- `CalendarsSettingsScreen`: Manages connected calendars, default calendar, etc.
- `EventTypesSettingsScreen`: Manages list of event types, creating/editing types.

### 3. Root List Organization
The Settings root screen will effectively become a dashboard of all available configuration categories. We will organize these logically (e.g., General, Calendars, Event Types, Integrations...) without requiring a click into a sub-menu like "Tools".

## Risks / Trade-offs

- **Risk**: Root settings screen becomes cluttered if there are too many items.
  - **Mitigation**: Use section headers or visual grouping within the single scrollable root list (e.g., "Planning", "Account", "System").
