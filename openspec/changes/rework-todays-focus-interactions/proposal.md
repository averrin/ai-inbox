## Why

The current interactions in the "Today's Focus" view lack precision and consistency with other parts of the app, such as the main task list. Reworking these interactions will prevent accidental drops on the calendar, simplify setting extended statuses, and make priority assignment more intuitive and consistent.

## What Changes

- **Drag and Drop**: Dropping tasks on the calendar view will be restricted to only work when grabbing a specific "handle" element, rather than anywhere on the task.
- **Extended Statuses**: A long press on the task checkbox in the "Today's Focus" view will open a menu or trigger to set extended statuses, mimicking the behavior from the main task list.
- **Priority Assignment**: A long press on the task item itself in the "Today's Focus" view will allow the user to set a priority, matching the behavior from the main task list.

## Capabilities

### New Capabilities
- `todays-focus-interactions`: Defines the drag-and-drop constraints and long-press interactions (checkbox for status, task item for priority) specific to the "Today's Focus" view.

### Modified Capabilities

## Impact

- `TodaysTasksPanel` component (and related subcomponents).
- Drag and drop handlers for tasks.
- Touch/press handlers for task checkboxes and task items.
