## Context

The current system uses a single `defaultCalendarId` for both event creation and as the primary source when merging duplicate events. This lacks flexibility for users who manage multiple synchronized calendars.

## Goals / Non-Goals

**Goals:**
- Separate "Default for Create" and "Default for Open/Prioritize" settings.
- Update UI to allow dual selection.
- Refine `mergeDuplicateEvents` to respect the "Default for Open" preference.
- Ensure event creation uses the "Default for Create" setting.

**Non-Goals:**
- Merging events with different titles/times (strict equality remains).
- Synchronization between calendars (this is handled by external providers).

## Decisions

### 1. State Store Schema Update
Modify `useSettingsStore` to include two distinct keys.
- **Rationale**: Keeps settings decoupled and explicit.
- **Keys**: `defaultCreateCalendarId`, `defaultOpenCalendarId`.
- **Migration**: On load, if new keys are null and `defaultCalendarId` exists, populate both from the old key.

### 2. Dual-Action Selection UI
In `CalendarsSettings.tsx`, each calendar list item will have two toggleable actions.
- **Action A (Create)**: `Ionicons name="add-circle-outline"` (selected: `add-circle`).
- **Action B (Open/Prioritize)**: `Ionicons name="eye-outline"` (selected: `eye`).
- **Rationale**: Using distinct icons avoids confusion about which "default" is being set.

### 3. Priority-Aware Merging Algorithm
Update `mergeDuplicateEvents(events: Event[], priorityCalendarId?: string | null)`:
- Group events by key: `${event.title}|${event.startDate}|${event.endDate}`.
- For each group:
  - If a member belongs to `priorityCalendarId`, select it as the representative.
  - Otherwise, select the first member.
- **Rationale**: Ensures the user's preferred calendar is the one they interact with for synced events.

## Risks / Trade-offs

- **[Risk] UI Clutter** → Mitigation: Use compact icons and clear descriptive text in the settings header.
- **[Risk] State Desync** → Mitigation: Maintain `defaultCalendarId` temporarily for backward compatibility if needed, but migrate internal logic to new keys immediately.
