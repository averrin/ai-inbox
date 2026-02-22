## ADDED Requirements

### Requirement: Long-Press Recognition
The system SHALL detect a long-press gesture on the calendar body/matrix.

#### Scenario: Trigger long-press
- **WHEN** user performs a long-press on an empty area of the calendar
- **THEN** a visual time selection marker appears under the finger
- **AND** the device provides haptic feedback (if supported).

### Requirement: Time selection marker
The system SHALL display a visual marker (e.g., a horizontal bar) indicating the selected time during a long-press interaction.

#### Scenario: Marker visibility
- **WHEN** long-press is active
- **THEN** a colored bar spanning the width of the column is shown
- **AND** the marker snaps to the nearest 15-minute interval.

### Requirement: Drag-to-adjust time
The system SHALL allow users to move the time selection marker by dragging their finger while maintaining the long-press.

#### Scenario: Adjusting time
- **WHEN** user moves their finger up or down while the marker is active
- **THEN** the marker follows the finger position
- **AND** the corresponding time is updated in the selection state.

### Requirement: Quick Action Menu
The system SHALL display a menu with action buttons upon releasing a long-press/drag gesture.

#### Scenario: Menu display
- **WHEN** user releases the finger after a long-press interaction
- **THEN** a menu with "Add Reminder" and "Add Event" buttons appears near the marker position.

#### Scenario: Cancel selection
- **WHEN** user taps outside the quick action menu
- **THEN** the menu and the time selection marker are dismissed.

### Requirement: Modal Integration
The system SHALL pre-fill the creation modals with the time selected via the long-press interaction.

#### Scenario: Create Event
- **WHEN** user selects "Add Event" from the quick action menu
- **THEN** the Event Creation modal opens
- **AND** the start time is set to the selected time.

#### Scenario: Create Reminder
- **WHEN** user selects "Add Reminder" from the quick action menu
- **THEN** the Reminder Creation modal opens
- **AND** the reminder time is set to the selected time.
