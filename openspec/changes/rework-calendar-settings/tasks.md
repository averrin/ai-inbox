## 1. Core Services & Store Updates

- [ ] 1.1 Update `SettingsStore` interface to include `personalCalendarIds`, `workCalendarIds`, `workAccountId`, and `calendarDefaultEventTypes`.
- [ ] 1.2 Implement migration logic in `SettingsStore` (reset "default" if invalid).
- [ ] 1.3 Update `calendarService` to support retrieving calendars by new groups (Personal, Work, Additional).

## 2. Event Creation Logic

-   [ ] 2.1 Update `createCalendarEvent` to check for `isWork` or `lunch` tags.
-   [ ] 2.2 Implement auto-invite logic in `createCalendarEvent` using `workAccountId`.
-   [ ] 2.3 Update `createCalendarEvent` to apply calendar-specific default event type if no type is provided.

## 3. UI Implementation

-   [ ] 3.1 Create `PersonalSettingsScreen` component.
-   [ ] 3.2 Create `WorkSettingsScreen` component.
-   [ ] 3.3 Create `AdditionalCalendarsScreen` (refactor existing `CalendarsScreen`).
-   [ ] 3.4 Update `CalendarDetailScreen` to include "Default Event Type" picker.
-   [ ] 3.5 Update main `SettingsScreen` navigation structure.

## 4. Verification

-   [ ] 4.1 Verify personal vs work calendar lists are distinct.
-   [ ] 4.2 Verify "Additional" list contains only unassigned calendars.
-   [ ] 4.3 Verify creating a work event (isWork=true) auto-invites work account.
-   [ ] 4.4 Verify creating a lunch event (lunch tag) auto-invites work account.
-   [ ] 4.5 Verify creating an event on a specific calendar uses its default type.
