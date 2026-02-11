# Design: Navigate Linked Items

Seamless bidirectional navigation between Tasks and Events by making linked item references interactive.

## Architecture

### Data Flow
- **Task -> Event**: `TaskEditModal` uses `Calendar.getEventAsync(id)` to load metadata. Interaction triggers the parent component to switch modals.
- **Event -> Task**: `EventFormModal` queries the global `useTasksStore` to find tasks referencing the current event ID. Interaction triggers the parent component to switch modals.

### Interfaces
- `TaskEditModalProps`: Add `onOpenEvent?: (id: string) => void`.
- `EventFormModalProps`: Add `onOpenTask?: (task: TaskWithSource) => void`.

## Implementation Details

### TaskEditModal
- Update the `linkedEvents` map in `useEffect` or the render loop (already uses `dayjs`) to format dates as `dddd, MMM D, h:mm A`.
- Wrap the linked event item in `TouchableOpacity`.
- Preserve the user's manual addition of `event_title` logic.

### EventFormModal
- Import `useTasksStore` and `RichTask`.
- Add `linkedTasks` state and a `useEffect` that runs when `visible` or `initialEvent` changes.
- Filter `tasksStore.tasks` for items where `event_id` (cast to string) contains the current event's ID.
- Render a "Linked Tasks" section using a list-like style similar to the "Linked Events" in the task modal.

### Modal Orchestration
- **ScheduleScreen.tsx**: Implement `onOpenTask` for `EventFormModal`. It will set `editingTask` (if state exists) or similar to trigger the task modal.
- **TasksFolderView.tsx**: Implement `onOpenEvent` for `TaskEditModal`. It will set `editingEvent` (if state exists) to trigger the event modal.

## Risks / Trade-offs

### Modal Management
- Opening a modal from another modal can be tricky with animations. Closing the first before opening the second is the safest approach to avoid UI glitches.
- State might need to be carefully handled to ensure the "back" flow works if desired (though not explicitly requested, keeping the background context stable is important).

### Syncing
- The `tasks` store must be up-to-date for `EventFormModal` to see the latest links. Since the store is globally managed and updated on save, this should be fine.
