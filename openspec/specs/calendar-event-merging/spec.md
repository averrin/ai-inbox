## ADDED Requirements

### Requirement: Merge Duplicate Calendar Events
The system SHALL identify and merge multiple calendar events that represent the same logical event into a single displayable event.

#### Scenario: Identical events from different calendars
- **WHEN** fetching events from multiple calendars (e.g., Local, Google)
- **AND** two events exist with identical Title, Start Time, and End Time
- **THEN** only one merged event is returned to the UI
- **AND** the merged event retains the properties (e.g., color) of the first found event

#### Scenario: Non-identical events (Title mismatch)
- **WHEN** two events have the same Start Time and End Time
- **BUT** their Titles differ (e.g., "Meeting A" vs "Meeting B")
- **THEN** both events are returned separately

#### Scenario: Non-identical events (Time mismatch)
- **WHEN** two events have the same Title
- **BUT** their Start Time or End Time differs (even by a minute)
- **THEN** both events are returned separately

#### Scenario: Multiple duplicates
- **WHEN** three or more identical events exist (Title, Start, End match)
- **THEN** only one merged event is returned
