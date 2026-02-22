## Context

The "Today's Focus" view (`TodaysTasksPanel`) currently allows dragging tasks by grabbing anywhere on the item, leading to accidental drags. Furthermore, it lacks the advanced interactions present in the main task list (extended statuses via checkbox long-press, priority via item long-press).

## Goals / Non-Goals

**Goals:**
- Prevent accidental drag-and-drop of tasks onto the calendar.
- Bring feature parity for task interactions between the main task list and Today's Focus.

**Non-Goals:**
- Changing exactly how the extended status or priority menus look.
- Modifying interactions in views other than Today's Focus.

## Decisions

- **Drag Handle**: We will introduce a specific drag handle icon on the task item in the Today's Focus view. The drag gesture will only be initiated if the user touches this handle.
- **Long Press Actions**: We will reuse the existing logic/components that the main task list uses to present the status and priority menus, hooking them up to `onLongPress` events on the Checkbox and the main `Pressable` wrapper of the task item in `TodaysTasksPanel`.

## Risks / Trade-offs

- **Risk**: The drag handle might steal touch events from the main item press if not positioned or sized correctly. Mitigation: Test touch targets carefully on smaller devices.
