## ADDED Requirements

### Requirement: Detect Free Time Zones
The system SHALL automatically detect periods of time with no high-difficulty events (difficulty >= 1) and visualize them as zones.

#### Scenario: Gap between difficult events
- **WHEN** there is a time gap greater than 60 minutes between two events that have difficulty >= 1
- **THEN** the system creates a "Free Time" zone covering that gap

#### Scenario: Inclusion of low-difficulty events
- **WHEN** the gap contains events with difficulty 0 (or undefined difficulty)
- **THEN** the system still includes that time in the Free Time zone (treating low-difficulty events as compatible with free time)

#### Scenario: Start and End of Day
- **WHEN** the first difficult event starts late or the last difficult event ends early
- **THEN** the system creates Free Time zones from 00:00 to the first event, and from the last event to 23:59 (ignoring sleep time logic for now)

### Requirement: Zone Visualization
The system SHALL render Free Time zones with specific visual properties to distinguish them from events and other ranges.

#### Scenario: Green Striped Appearance
- **WHEN** rendering a Free Time zone
- **THEN** it is displayed with a pale green background color
- **AND** ideally has a striped pattern (implementation dependent)
