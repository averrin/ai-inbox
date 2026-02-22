## Context

The application currently renders meetings and markers. We need to introduce "Time Ranges" - recurring background blocks (like working hours) that recur on specific days.

## Goals / Non-Goals

**Goals:**
- Store and manage recurring time range definitions.
- Dynamically project these definitions onto the calendar view based on the currently visible dates.
- Render them using the existing `CalendarZone` capability of `CalendarBody`.

**Non-Goals:**
- Integration with external calendars (Google Calendar working hours) - this is local only for now.
- complex recurrence rules (e.g., "3rd Friday of month"). Simple weekly recurrence only.

## Decisions

### Data Model
We will introduce a `TimeRangeDefinition` interface:
```typescript
interface TimeRangeDefinition {
  id: string;
  title: string;
  start: { hour: number; minute: number }; // Time of day
  end: { hour: number; minute: number };
  days: number[]; // 0-6 (Sun-Sat)
  color: string;
  isEnabled: boolean;
}
```

### State Management
We will create a `TimeRangeStore` (using Zustand, matching existing patterns) to persist these definitions.

### Calendar Integration
We will NOT modify `CalendarBody` to know about "Time Ranges".
Instead, we will create a hook `useTimeRangeEvents(dateRange: Dayjs[])` that:
1. Reads `TimeRangeDefinition`s.
2. Iterates over the rendered `dateRange`.
3. Checks if a definition is active for that day.
4. Generates transient `ICalendarEventBase` objects with `type: 'range'`.
5. Merges these into the `events` array passed to `CalendarScreen`.

This leverages the existing `range` rendering logic in `CalendarBody` (mapping to `CalendarRange` component), which renders as a colored strip on the left side of the day column.


### UI
- A simple "Time Ranges" management modal, accessible from the Schedule Screen header or settings.
- Form controls: Title input, Time pickers (Start/End), Day toggles (S M T W T F S), Color picker.

## Risks / Trade-offs
- **Performance**: Generating zone events on the fly for large ranges. Since the view range is usually small (1-7 days), this is negligible.
- **Overlapping**: Zones might overlap events. `CalendarZone` usually renders in the background (check z-index), which is desired.
