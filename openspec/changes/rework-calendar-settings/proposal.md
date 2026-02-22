## Why

The current implementation mixes personal and work contexts in calendar settings, making it difficult to manage distinct identities and behaviors. Splitting these into explicit "Personal" and "Work" sections will streamline configuration, clarify event ownership, and enable context-aware automation like auto-invites.

## What Changes

-   **Personal & Work Separation**: Split "Calendars" settings into distinct "Personal" and "Work" sections.
-   **Account Ownership**: Assign specific accounts to Personal and Work sections.
-   **Remove "My Addresses"**: Eliminate this section entirely as it becomes redundant.
-   **Context-Aware Invites**: Events tagged as `isWork` or `lunch` will automatically invite the configured work account.
-   **Default Event Types**: Each calendar can have a default event type applied to new untyped events from that calendar.
-   **Settings Reorganization**:
    -   Existing "Calendars" screen becomes "Additional Calendars".
    -   "Default for create and open" settings move to the new Personal/Work sections.
    -   "Additional Calendars" is demoted in the settings hierarchy.

## Capabilities

### New Capabilities
-   `context-aware-invites`: Automatically inviting work accounts based on event tags (isWork, lunch).
-   `calendar-specific-event-types`: Assigning default event types per calendar.

### Modified Capabilities
-   `calendar-configuration`: Updating how calendars are grouped and assigned (Personal/Work/Additional).
-   `settings-navigation`: Reorganizing the settings menu structure.
-   `event-type-assignment`: Extending assignment logic to support calendar-level defaults.

## Impact

-   **Settings Store**: Needs updates to store personal/work calendar assignments and per-calendar default event types.
-   **Calendar Service**: Logic for filtering and fetching events needs to respect new groupings.
-   **Event Creation**: `createCalendarEvent` needs to handle automated invites and apply default event types.
-   **UI**:
    -   New settings screens for Personal/Work calendars.
    -   Modified main settings list.
    -   Updated "Additional Calendars" screen.
