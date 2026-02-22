## Why

The current lunch event detection is rudimentary and lacks practical utility. Users need a smarter, more integrated way to manage their lunch break that respects their schedule (prioritizing free time, then skippable/movable events), visualizes the suggested slot clearly but unobtrusively, and allows for easy confirmation ("materialization") into a real calendar event with collaboration features (inviting a contact).

## What Changes

- **Smarter Detection Logic**:
  - Implement a prioritized search within the "Lunch" time range: Free Time > Skippable Events > Movable Events.
  - Apply difficulty penalties for sub-optimal placements (+1 day difficulty if intersecting movable, +2 if not placed).
- **Enhanced Visualization**:
  - Render the ephemeral lunch event with the "Lunch" range color, high transparency, and a dashed border.
  - Ensure it is distinct from standard calendar events and other ranges.
- **Interactive Management**:
  - Clicking the ephemeral event opens a specialized Edit Modal.
  - Modal allows adjusting time and "Materializing" the event.
- **Materialization Workflow**:
  - "Materialize" button creates a real event in a specific calendar.
  - Optionally invites a configured contact.
- **Configuration**:
  - New settings section for "Lunch Events".
  - Options for target calendar and invitee.

## Capabilities

### New Capabilities
- `lunch-management`: Handles the logic for detecting the optimal lunch slot, the ephemeral "Lunch" event lifecycle, and the materialization workflow.

### Modified Capabilities
- `event-type-configuration`: Updated to include specific configuration for Lunch events (target calendar, default invitee).

## Impact

- **Components**: `ScheduleScreen`, `CalendarBody`, specialized `LunchEvent` or modified `ScheduleEvent`.
- **Store**: `useEventTypesStore` (or new store slice) for lunch settings.
- **Services**: `calendarService` for creating the actual event.
