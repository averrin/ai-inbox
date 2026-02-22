## Context

The current `ScheduleScreen` contains a rudimentary `detectLunchEvent` helper. We need to formalize this logic, improve the heuristic for placing the lunch slot, and provide a user interface for managing (confirming/materializing) this lunch break into a real calendar event.

## Goals / Non-Goals

**Goals:**
- Implement the "Smart Lunch" detection algorithm (Free > Skippable > Movable).
- Visualize the lunch slot distinctively (transparent, dashed).
- Provide a workflow to "Materialize" the lunch slot into the user's calendars.
- Allow configuration of default calendar and invitee for lunch events.

**Non-Goals:**
- Automatic materialization (user must always confirm/materialize manually).
- complex recurrence patterns for lunch beyond the daily range definition.

## Decisions

### 1. Detection Logic Location
We will extract the detection logic from `ScheduleScreen.tsx` into a dedicated hook `useLunchOne` (or similar) or a utility in `services/lunchService`.
Given it needs access to events, ranges, and flags, a hook `useLunchSuggestion(events, ranges, date)` seems appropriate to reactively calculate the slot.

### 2. Event Representation
The ephemeral lunch event will use a specific type tag `LUNCH_SUGGESTION`.
In `ScheduleEvent.tsx`, we will check for this tag to apply:
- Background: Lunch range color with high alpha (transparency).
- Border: Dashed, same color.
- Title: "Lunch (Suggested)".

### 3. Interaction & Modal
We will create a new `LunchContextModal.tsx`.
- **Input**: The ephemeral event data.
- **Content**:
  - Time Picker (Start/End).
  - "Save" (updates ephemeral state for this session - maybe needs local state or store?). *Note: Updating an ephemeral event is tricky if it's re-calculated. We might just rely on "Materialize" to save it permanently.*
  - "Materialize" button.
- **Action**:
  - "Materialize" calls `calendarService.createEvent` using the configured settings.

### 4. Configuration
We will add a new section "Lunch Settings" in the Settings screen (likely new component `LunchSettings.tsx`).
State will be stored in `useSettingsStore`:
```typescript
interface LunchConfig {
  targetCalendarId: string | null;
  defaultInvitee: string | null;
}
```

### 5. Scoring & Difficulty
The detection logic will calculate "Day Difficulty" penalties:
- +1 if intersecting a 'Movable' event.
- +2 if no slot found (Missed Lunch).
This connects with the `utils/difficultyUtils.ts`.

## Risks / Trade-offs

**Risk**: Detection logic performance on busy days.
**Mitigation**: The loop is over 5-minute increments for one range (Lunch) on one day. 12 hours * 12 slots = 144 iterations max. Negligible.

**Risk**: Ephemeral event persistence.
**Trade-off**: If user edits the "Suggested" lunch time but doesn't materialize, does it stay?
**Decision**: For V1, editing the time in the modal and hitting "Save" (if not materializing) might effectively be "Materializing to local app state" or just Materializing to Calendar.
**Refinement**: The prompt says "button save and button materialize".
- "Save": Maybe adjusts the suggestion for the session? Or maybe creates an internal "Lunch" block that isn't on the calendar yet?
- Simplification: "Save" could just create a local "Blocker" event event in the internal `events` array if we had one.
- For now, let's assume "Save" means "Update the ephemeral visual" (maybe using a local override store) and "Materialize" means "Push to Real Calendar".

