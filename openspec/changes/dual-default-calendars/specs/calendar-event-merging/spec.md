## MODIFIED Requirements

### Requirement: Merge Duplicate Calendar Events
The system SHALL identify and merge multiple calendar events that represent the same logical event into a single displayable event.

#### Scenario: Identical events from different calendars
- **WHEN** fetching events from multiple calendars (e.g., Local, Google)
- **AND** two events exist with identical Title, Start Time, and End Time
- **THEN** only one merged event is returned to the UI
- **AND** the merged event retains the properties (e.g., color, source calendar) of the event from the "Default for Open" calendar if available
- **AND** otherwise retains the properties of the first found event
