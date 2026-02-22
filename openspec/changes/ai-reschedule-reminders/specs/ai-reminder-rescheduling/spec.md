## ADDED Requirements

### Requirement: AI Rescheduling "Later"
The system SHALL provide a "Later" rescheduling option that intelligently selects a new time slot for the current day or the following day.

#### Scenario: Same-day Reschedule
- **WHEN** the user triggers "Later" reschedule
- **WHEN** there is a free slot within work hours later today (minimum 15 mins)
- **WHEN** the slot does not overlap with events of difficulty > 0
- **THEN** the system SHALL select the next available suitable slot today.

#### Scenario: Next-day Fallback
- **WHEN** the user triggers "Later" reschedule
- **WHEN** no suitable free slot exists today within work hours
- **THEN** the system SHALL select a suitable slot tomorrow morning.

### Requirement: AI Rescheduling "Tomorrow"
The system SHALL provide a "Tomorrow" rescheduling option that selects a time on the next day close to the original time.

#### Scenario: Next-day Target
- **WHEN** the user triggers "Tomorrow" reschedule
- **THEN** the system SHALL select a time on the following day that is close to the original scheduled time
- **THEN** the selected time SHALL NOT overlap with events of difficulty > 0.

### Requirement: Context-Aware Slot Selection
The rescheduling logic SHALL interpret the reminder title and content to ensure the suggested time is contextually appropriate.

#### Scenario: Social/Contextual Constraints
- **WHEN** the reminder title contains keywords like "call", "appointment", or "meeting"
- **THEN** the AI SHALL avoid suggesting slots outside of standard business hours or late in the evening.
