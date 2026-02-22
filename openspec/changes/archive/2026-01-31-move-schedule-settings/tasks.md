## 1. Preparation

- [x] 1.1 Identify all settings currently residing in the "Tools" screen.
- [x] 1.2 Locate existing components for Calendar settings and Event Type settings (if mixed, plan separation).

## 2. Component Implementation

- [x] 2.1 Create `CalendarsSettingsScreen` component (or isolate existing logic).
- [x] 2.2 Create `EventTypesSettingsScreen` component (or isolate existing logic).
- [x] 2.3 Refactor any other "Tools" settings into standalone components if necessary.

## 3. Navigation Restructuring

- [x] 3.1 Update the Settings Navigator stack to include `CalendarsSettings` and `EventTypesSettings` as direct routes.
- [x] 3.2 Remove `ToolsSettings` route from the navigator.
- [x] 3.3 Update the root `SettingsScreen` list to include "Calendars" and "Event Types" items linking to the new routes.
- [x] 3.4 Ensure any other items that were in Tools are also added to the root list.

## 4. Verification

- [x] 4.1 Verify "Tools" option is gone from Settings.
- [x] 4.2 Verify "Calendars" opens the calendars configuration.
- [x] 4.3 Verify "Event Types" opens the event types configuration.
- [x] 4.4 Verify no functionality was lost during the move.
