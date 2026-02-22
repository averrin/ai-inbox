## Context

The current `ReminderEditModal` allows manual rescheduling but lacks quick, intelligent options. Users often need to push tasks to "later" or "tomorrow" without manually searching for free slots in their calendar.

## Goals / Non-Goals

**Goals:**
- Implement "Later" and "Tomorrow" buttons in `ReminderEditModal`.
- Automate slot finding using LLM intelligence.
- Respect work hours and event difficulty levels.
- Consider context (e.g., avoiding evening slots for business calls).

**Non-Goals:**
- Fully automated rescheduling without user intent.
- Handling complex recurring rules in the initial version.

## Decisions

1. **AI Integration**: Add a dedicated `rescheduleReminderWithAI` function in `services/gemini.ts`. This function will take the reminder data and schedule context.
2. **Context Payload**:
    - Current local ISO time.
    - User's work hours (from `store/settings.ts`).
    - Visible events within the relevant window (today and tomorrow).
    - Event difficulties and types to identify "protected" slots.
3. **UI Placement**: Place the new buttons in the `ReminderEditModal` alongside the "Show" button.
4. **Reschedule Strategy**:
    - **Later**: Targets today's work hours first. Falls back to tomorrow morning if no suitable slot is found today.
    - **Tomorrow**: Targets the same relative time on the next day, adjusting for conflicts.
5. **Conflict Definition**: A conflict is defined as an overlap with any event having a non-zero difficulty or an appointment type that the AI deems "unbreakable".

## Risks / Trade-offs

- **[Risk]** AI latency impacts UX. → **[Mitigation]** Use a loading spinner on the button and cache the schedule context to minimize payload.
- **[Risk]** Hallucinated times. → **[Mitigation]** The UI will update with the new time, and the user can still manually adjust before saving (or the action itself performs the update and refreshes the view). *Decision: The button should update the modal's state immediately, allowing the user to see the suggested time and then hit "Save". This provides a safety check.*
