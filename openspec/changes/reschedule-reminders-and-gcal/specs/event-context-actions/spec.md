## ADDED Requirements

### Requirement: Open Google Calendar
The system SHALL provide an action to open the selected event in the Google Calendar app (or web view) if the event is synced from Google Calendar.

#### Scenario: Button Visibility
- **WHEN** user opens the context menu for a Google Calendar event
- **THEN** an "Open in Google Calendar" button is visible
- **WHEN** user opens the context menu for a local reminder or non-Google event
- **THEN** the "Open in Google Calendar" button is NOT visible

#### Scenario: Button Action
- **WHEN** user taps "Open in Google Calendar"
- **THEN** the system attempts to open the event in the external Google Calendar app via deep link
- **OR** falls back to opening the calendar app at the event's date if a specific deep link is unavailable
