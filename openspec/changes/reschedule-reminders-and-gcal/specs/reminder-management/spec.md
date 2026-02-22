## ADDED Requirements

### Requirement: Drag and Drop Rescheduling
The system SHALL allow users to reschedule reminders by dragging them to a new time slot on the schedule view.

#### Scenario: Initiate Drag
- **WHEN** user long-presses a reminder item on the calendar
- **THEN** the reminder item lifts visually (scale/opacity change) indicating it is ready to move

#### Scenario: Visual Feedback During Drag
- **WHEN** user drags the reminder item
- **THEN** the reminder follows the user's finger
- **AND** a ghost or snap indicator shows the nearest 15-minute time slot where it would land

#### Scenario: Drop to Reschedule
- **WHEN** user releases the reminder item over a valid time slot
- **THEN** the reminder snaps to that time slot
- **AND** the reminder's persistent start time is updated to the new slot
- **AND** a haptic feedback confirms the action
