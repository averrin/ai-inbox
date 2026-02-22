## ADDED Requirements

### Requirement: Drag Handle
The system SHALL require the use of a dedicated drag handle to initiate dragging a task from the Today's Focus list onto the calendar.

#### Scenario: Dragging a task
- **WHEN** user attempts to drag a task by grabbing the drag handle
- **THEN** the task becomes draggable and can be dropped on the calendar
- **WHEN** user attempts to drag a task by grabbing any other part of the task item
- **THEN** the task does not become draggable

### Requirement: Checkbox Long Press
The system SHALL allow setting extended statuses via a long press on the task's checkbox in the Today's Focus view.

#### Scenario: Long pressing the checkbox
- **WHEN** user long-presses the checkbox of a task in the Today's Focus view
- **THEN** a menu or modal appears allowing the selection of extended statuses (like deferred, cancelled, etc.)

### Requirement: Task Item Long Press
The system SHALL allow setting task priority via a long press on the task item itself in the Today's Focus view.

#### Scenario: Long pressing the task item
- **WHEN** user long-presses the task item in the Today's Focus view (outside of the checkbox and drag handle)
- **THEN** a menu or modal appears allowing the selection of a priority level for the task
