## Why

Manually rescheduling reminders is a common task that requires checking the current schedule, work hours, and task difficulty to avoid conflicts. Adding AI-powered "Later" and "Tomorrow" buttons reduces cognitive load by automatically finding the most suitable time slots based on the user's context and preferences.

## What Changes

- **UI**: Added "Later" and "Tomorrow" buttons to the `ReminderEditModal`.
- **Logic**: Integrated LLM-based rescheduling logic that:
    - Analyzes the current schedule and free time slots.
    - Honors work-hour constraints (for "Later").
    - Avoids overlaps with non-zero difficulty events.
    - Considers the nature of the reminder (e.g., preventing phone calls at inappropriate times).
- **Service**: New service function or utility to handle AI rescheduling requests.

## Capabilities

### New Capabilities
- `ai-reminder-rescheduling`: Provides AI-driven time slot selection for reminders based on schedule context and user preferences.

### Modified Capabilities
- (None)

## Impact

- `components/ReminderEditModal.tsx`: UI changes to include new buttons and trigger rescheduling.
- `services/reminderService.ts`: Addition of `rescheduleWithAI` or similar logic.
- `services/gemini.ts`: Addition of specific prompt for rescheduling suggestions.
- `store/settings.ts`: Potential use of work hours/preferences in the prompt context.
