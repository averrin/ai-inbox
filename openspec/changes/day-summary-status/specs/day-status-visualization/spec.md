## ADDED Requirements

### Requirement: Day Status Visualization
The system SHALL visualize the "Day Status" using a colored indicator based on a combined score of total difficulty and deep work duration.

#### Scenario: Healthy Day
- **WHEN** total difficulty is < 3 AND deep work duration is < 1 hour
- **THEN** the status indicator SHALL be Green.

#### Scenario: Moderate Day (Difficulty Driven)
- **WHEN** total difficulty is >= 3 AND total difficulty < 6
- **AND** deep work duration is < 3 hours
- **THEN** the status indicator SHALL be Yellow/Lime.

#### Scenario: Busy Day (Duration Driven)
- **WHEN** deep work duration is >= 3 hours
- **THEN** the status indicator SHALL be at least Orange, regardless of difficulty score.

#### Scenario: Overloaded Day
- **WHEN** deep work duration is >= 5 hours
- **OR** total difficulty is >= 9
- **THEN** the status indicator SHALL be Red.
