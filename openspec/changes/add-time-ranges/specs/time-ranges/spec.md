## ADDED Requirements

### Requirement: Define Time Range
The system SHALL allow users to create a time range definition with a title, start time, end time, active days of the week, and a display color.

#### Scenario: Create Time Range
- **WHEN** user submits a valid time range form (Title: "Gym", Start: 07:00, End: 08:00, Days: [Mon, Wed, Fri], Color: Blue)
- **THEN** system saves the time range
- **AND** the time range appears in the list of active ranges

### Requirement: List Time Ranges
The system SHALL display a list of all defined time ranges, showing their key details (title, times, days).

#### Scenario: View List
- **WHEN** user navigates to the Time Ranges settings
- **THEN** system displays all configured time ranges ordered by start time

### Requirement: Edit Time Range
The system SHALL allow users to modify any property of an existing time range.

#### Scenario: Update Days
- **WHEN** user changes active days for "Gym" from [Mon, Wed, Fri] to [Tue, Thu]
- **THEN** system updates the time range
- **AND** the calendar reflects the change immediately

### Requirement: Delete Time Range
The system SHALL allow users to permanently remove a time range.

#### Scenario: Delete Range
- **WHEN** user selects "Delete" on a time range
- **THEN** system removes the time range
- **AND** it no longer appears on the calendar

### Requirement: Visualize Time Ranges
The system SHALL render active time ranges on the calendar view as distinct visual blocks, strictly adhering to their time windows and active days.

#### Scenario: Render on Calendar
- **WHEN** viewing the calendar for a Monday using the "Gym" example (Mon, 07:00-08:00)
- **THEN** a colored block labeled "Gym" renders from 07:00 to 08:00
- **AND** it is visually distinct from standard events (e.g., background shading or specific marker style)

#### Scenario: No Render on Inactive Day
- **WHEN** viewing the calendar for a Tuesday (inactive day for "Gym")
- **THEN** the "Gym" block is NOT visible
