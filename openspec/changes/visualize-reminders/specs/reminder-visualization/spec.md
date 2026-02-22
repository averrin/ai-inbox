## ADDED Requirements

### Requirement: Fetch and Store Reminders in Schedule
The system SHALL retrieve active reminders from the reminder store and maintain them in the schedule view state.

#### Scenario: Subscribing to store updates
- **WHEN** the ScheduleScreen mounts
- **THEN** it SHALL subscribe to the `useRemindersStore` to receive updates when reminders are added, modified, or deleted

#### Scenario: Filtering reminders
- **WHEN** processing reminders for display
- **THEN** it SHALL ignore reminders that do not have a due date

### Requirement: Visualize Reminders on Timeline
The system SHALL render reminders as "markers" on the calendar timeline at their specifc due time.

#### Scenario: Rendering markers
- **WHEN** a reminder with a valid due date exists within the current view range
- **THEN** it SHALL be rendered as a horizontal marker line across the calendar view
- **AND** the marker SHALL display the reminder title

#### Scenario: Marker timing
- **WHEN** a reminder is set for a specific time (e.g., 14:00)
- **THEN** the marker SHALL appear exactly at that time slot on the vertical timeline

### Requirement: Interact with Reminder Markers
The system SHALL allow users to modify reminders directly from the calendar view.

#### Scenario: Tapping a reminder marker
- **WHEN** the user taps on a rendered reminder marker
- **THEN** the system SHALL open the `ReminderModal` pre-populated with that reminder's data
- **AND** allowing the user to edit details or mark it as complete
