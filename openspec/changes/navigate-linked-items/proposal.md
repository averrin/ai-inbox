# Proposal: Navigate Linked Items

Enable seamless navigation between linked tasks and events in the edit modals, making the "Linked Items" section interactive.

## Goal

- Enable opening the `EventFormModal` from the "Linked Events" list in `TaskEditModal`.
- Enable opening the `TaskEditModal` from a new "Linked Tasks" section in `EventFormModal`.
- Improve the display of linked events by showing the weekday and time.
- Ensure cross-navigation works in both directions without losing state (if possible) or by correctly switching modal context.

## Context

Current tasks can have an `event_id` property (comma-separated list of calendar event IDs). `TaskEditModal` already displays these as a static list. `EventFormModal` handles both calendar events and reminders but currently lacks any awareness of tasks that might be referencing them.

## Impact

### Task Subsystem
- `TaskEditModal.tsx`: Visual improvements to linked event list items; interaction added.
- Navigation logic to trigger event editing.

### Event Subsystem
- `EventFormModal.tsx`: New "Linked Tasks" section added to the bottom of the form.
- Logic to query `useTasksStore` for tasks referencing the current event ID.
- Navigation logic to trigger task editing.

### Global Store / State
- Navigation might require coordination in `ScheduleScreen.tsx` and `TasksFolderView.tsx` to handle modal handoffs.
