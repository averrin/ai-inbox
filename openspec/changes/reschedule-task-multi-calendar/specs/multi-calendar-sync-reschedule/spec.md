## ADDED Requirements

### Requirement: Synchronized Multi-Calendar Rescheduling
The system SHALL ensure that when a task linked to multiple calendar events is rescheduled, all associated calendar events are updated to the same new time slot.

#### Scenario: Rescheduling a task with multiple event links
- **WHEN** a user initiates a "Later" or "Tomorrow" reschedule on a task
- **AND** the task has multiple IDs in its `event_id` property (e.g., "id1, id2")
- **THEN** the system SHALL calculate a new time slot
- **AND** SHALL update both "id1" and "id2" calendar events to that new slot
- **AND** SHALL update the task's own date property

#### Scenario: Partial update failure
- **WHEN** updating multiple event IDs during a reschedule
- **AND** one update fails (e.g., "id1" succeeds but "id2" fails)
- **THEN** the system SHALL proceed with updating the task date
- **AND** SHOULD log the failure for the specific event ID without blocking the entire operation
