## ADDED Requirements

### Requirement: Assign Type to Event Series
The system SHALL allow assigning an Event Type to an event series, identified by the event's Title. The assignment SHALL store the Type's ID, not its name.

#### Scenario: Assign type to series
- **WHEN** user assigns type "Gym" (ID: 123) to an event with title "Morning Workout"
- **THEN** a mapping is created: "Morning Workout" -> "123"
- **AND** this mapping is saved to the Vault

#### Scenario: Rename Type
- **WHEN** user renames "Gym" (ID: 123) to "Fitness"
- **THEN** the mapping "Morning Workout" -> "123" remains unchanged
- **AND** the event "Morning Workout" now resolves to "Fitness" via ID lookup

#### Scenario: Visual Override
- **WHEN** an event matches an assigned type
- **THEN** the event color is replaced by the type's color in the Schedule view
- **AND** a small tag with the type name (e.g., "Gym") is displayed on the event block

#### Scenario: Unassign type
- **WHEN** user removes the type assignment from "Morning Workout"
- **THEN** events with that title revert to their original calendar source color
