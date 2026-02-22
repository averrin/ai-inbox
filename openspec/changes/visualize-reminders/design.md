## Context

Users currently have to switch between the Schedule view and the Reminders list to manage their day. The `react-native-big-calendar` library (with our custom patches) now supports a "marker" event type, ideal for point-in-time items like reminders. We aim to inject stored reminders into the calendar view.

## Goals / Non-Goals

**Goals:**
-   Visualize reminders as "markers" on the ScheduleScreen at their due time.
-   Allow users to tap a reminder marker to view/edit it (opening `ReminderModal`).
-   Update markers in real-time when reminders are added/edited in other screens.

**Non-Goals:**
-   Dragging/dropping reminders on the calendar (v1 is read-only visualization).
-   Visualizing reminders without due times (they cannot be placed on the timeline).
-   Complex conflict resolution with standard events (markers overlay events naturally).

## Decisions

### 1. Data Source: `useRemindersStore`
We will subscribe to `useRemindersStore` within `ScheduleScreen`. This ensures that any changes to reminders (sync, edit, delete) automatically trigger a re-render of the calendar.
**Rationale:** Leveraging the existing Zustand store avoids duplicate fetching logic and ensures state consistency across the app.

### 2. Mapping Logic
We will create a `useMemo` hook to transform `reminders` into `ICalendarEventBase[]` objects.
-   **Filter:** `reminder.dueDate` must exist.
-   **Mapper:**
    -   `start`: `new Date(reminder.dueDate)`
    -   `end`: `new Date(reminder.dueDate)` (markers are point-in-time)
    -   `title`: `reminder.title`
    -   `type`: `'marker'`
    -   `originalReminder`: `reminder` (custom prop to link back to source)
    -   `color`: Derive from priority (e.g., High = Red, Med = Orange) or default color.

### 3. Interaction Handling
The `BigCalendar`'s `onPressEvent` currently sets `selectedEventTitle` for the context menu. We will intercept this.
-   If `event.type === 'marker'`: Open `ReminderModal` with the `event.originalReminder`.
-   Else: Proceed with existing context menu logic (`setSelectedEventTitle`).

## Risks / Trade-offs

-   **Performance:** A large number of reminders could slow down the mapping or rendering.
    -   *Mitigation:* `useMemo` for mapping. The calendar component handles virtualization, so rendering valid pages should be performant.
-   **UI Clutter:** Many reminders at the same time as events might clutter the view.
    -   *Mitigation:* Markers are designed to be low-profile (lines across the timeline) rather than full blocks, minimizing overlap issues.

## Migration Plan

No data migration required. This is a UI-only feature consuming existing data.
