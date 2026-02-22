## ADDED Requirements

### Requirement: Smart Lunch Detection
The system SHALL detect optimal lunch slots within the defined "Lunch" time range, prioritizing Free Time > Skippable Events > Movable Events.

#### Scenario: Free time available
- **WHEN** there is a gap of at least 60 minutes in the Lunch range
- **THEN** an ephemeral lunch event is placed in that gap

#### Scenario: Movable event overlap
- **WHEN** no free time slot exists
- **AND** there is a slot overlapping only movable events
- **THEN** an ephemeral lunch event is placed there
- **AND** the day difficulty score increases by 1

#### Scenario: Missed Lunch
- **WHEN** no suitable slot is found in the Lunch range
- **THEN** a "Missed Lunch" marker is created at the end of the range
- **AND** the day difficulty score increases by 2

### Requirement: Lunch Visualization
The system SHALL render the ephemeral lunch event with specific visual cues.

#### Scenario: Rendering
- **WHEN** displaying the ephemeral lunch event
- **THEN** it has the color of the "Lunch" range
- **AND** it has high transparency
- **AND** it has a dashed border

### Requirement: Lunch Materialization
The system SHALL allow users to convert the ephemeral lunch event into a real calendar event.

#### Scenario: Materializing
- **WHEN** user clicks "Materialize" on the Lunch Modal
- **THEN** a real event is created in the configured target calendar
- **AND** the configured contact is invited (if any)
