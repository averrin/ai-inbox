# Capability: Free Time Detection

## Purpose
To identify and surface blocks of time available for focus or breaks.

## Requirements

### Requirement: Detect Free Time Zones
The system SHALL automatically detect periods of time with no high-difficulty events (difficulty >= 1) **within designated Work Ranges** and visualize them as zones.

#### Scenario: Gap between difficult events
- **WHEN** there is a time gap greater than 60 minutes between two events that have difficulty >= 1
- **AND** this gap falls within an enabled "Is Work" time range
- **THEN** the system creates a "Free Time" zone covering that gap (intersected with the work range)

#### Scenario: Inclusion of low-difficulty events
- **WHEN** the gap contains events with difficulty 0
- **THEN** the system still includes that time in the Free Time zone

#### Scenario: Start and End of Range
- **WHEN** the gap exists between the start of the Work Range and the first event, or the last event and end of Work Range
- **THEN** the system creates Free Time zones for those periods

### Requirement: Zone Visualization
The system SHALL render Free Time zones with specific visual properties.

#### Scenario: Green Striped Appearance
- **WHEN** rendering a Free Time zone
- **THEN** it is displayed with a pale green background color and a striped pattern.
