# Implementation Tasks: Navigate Linked Items

Checklist for implementing bidirectional navigation between tasks and events.

## 1. TaskEditModal Enhancements

- [x] 1.1 Update `linkedEvents` mapping in `useEffect` to include `dayjs` formatting and `event_title` logic.
- [x] 1.2 Replace `View` with `TouchableOpacity` for linked event items and add `onPress` handler.
- [x] 1.3 Add `onOpenEvent` prop to `TaskEditModal` and call it when an item is pressed.

## 2. EventFormModal Enhancements

- [x] 2.1 Add `linkedTasks` state and `useEffect` to fetch tasks from `useTasksStore` referencing the current event ID.
- [x] 2.2 Render "Linked Tasks" section at the bottom of the scroll view with interactable items.
- [x] 2.3 Add `onOpenTask` prop to `EventFormModal` and call it when an item is pressed.

## 3. Modal Orchestration

- [x] 3.1 Implement modal switching in `TasksFolderView.tsx` (open event from task edit).
- [x] 3.2 Implement modal switching in `ScheduleScreen.tsx` (open task from event edit).
- [x] 3.3 Ensure modals are closed properly before opening the next one to avoid UI layering issues.
