# FEATURE: Linked Items Navigation

Bidirectional interaction between tasks and calendar events.

## SCENARIO: Opening Event from Task
- **GIVEN** a task with an `event_id` property
- **WHEN** the user opens the `TaskEditModal`
- **THEN** the linked events are listed with weekday and time (e.g., "Monday, Feb 9, 7:00 PM")
- **WHEN** the user taps a linked event item
- **THEN** the `TaskEditModal` closes
- **AND** the `EventFormModal` opens for the selected event

## SCENARIO: Opening Task from Event
- **GIVEN** an event with one or more tasks referencing its ID
- **WHEN** the user opens the `EventFormModal`
- **THEN** a "Linked Tasks" section appears at the bottom
- **WHEN** the user taps a linked task item
- **THEN** the `EventFormModal` closes
- **AND** the `TaskEditModal` opens for the selected task

## SCENARIO: Display Formatting
- **GIVEN** a linked event is rendered in `TaskEditModal`
- **THEN** it must show `dddd, MMM D, h:mm A` format (e.g. "Monday, Feb 9, 7:00 PM")
- **AND** it must show the event title (preferring `event_title` property if present on the task)
