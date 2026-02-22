## Context

Currently, calendar settings are unified, treating all calendars as equal peers. This becomes problematic for users who need to strictly separate their personal and professional lives, both in terms of event visibility and automated behaviors (like invites).

## Goals / Non-Goals

**Goals:**
-   Provide a clear UI distinction between Personal and Work calendar configurations.
-   Enable "set and forget" automation for work-related invites.
-   Allow granular control over default event types per calendar to speed up event creation.

**Non-Goals:**
-   Supporting more than two contexts (e.g., "Hobby", "Side Project"). We are sticking to "Personal" and "Work" for now.
-   Complex rule-based automation beyond simple tag matching for invites.

## Decisions

-   **Settings Storage**: We will expand `SettingsStore` to hold:
    -   `personalCalendarIds`: string[]
    -   `workCalendarIds`: string[]
    -   `workAccountId`: string (email or ID for the work account to invite)
    -   `calendarDefaultEventTypes`: Record<string, string> (calendarId -> eventTypeId)
-   **Invite Automation**: Logic will reside in `createCalendarEvent`. If `isWork` or `lunch` tag is present, we check `SettingsStore.workAccountId` and add it to attendees.
-   **UI Structure**: We will introduce two new settings screens (`PersonalSettings`, `WorkSettings`) and repurpose the existing `Calendars` screen for "Additional Calendars" (read-only or secondary calendars).

## Risks / Trade-offs

-   **Migration**: Existing "default calendar" settings might point to a calendar that is now categorized as "Additional".
    -   *Mitigation*: We will reset the default calendar setting if the currently selected one isn't in Personal/Work, or prompt the user to re-select.
-   **Complexity**: Adding per-calendar defaults increases the configuration surface area.
    -   *Mitigation*: Keep these settings inside the specific calendar's detail view, not in the top-level list.
