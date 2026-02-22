## 1. AI Service Logic

- [ ] 1.1 Add `rescheduleReminderWithAI` function to `services/gemini.ts`
- [ ] 1.2 Implement specialized prompt for selecting valid time slots based on context
- [ ] 1.3 Create utility to gather schedule context (events, work hours, current time)

## 2. Modal Integration

- [ ] 2.1 Add "Later" and "Tomorrow" buttons to `ReminderEditModal.tsx`
- [ ] 2.2 Implement `handleAIReschedule` logic in `ReminderEditModal`
- [ ] 2.3 Add loading state indicators for AI processing
- [ ] 2.4 Hook up AI response to update the modal's internal state (time/date)

## 3. Polish & Refinement

- [ ] 3.1 Implement error handling for AI failures with user-facing toasts
- [ ] 3.2 Ensure the UI feels responsive and premium during the "AI thinking" phase
- [ ] 3.3 Verify "Later" and "Tomorrow" logic via manual testing

## 4. Verification

- [ ] 4.1 Verify "Later" respects work hours
- [ ] 4.2 Verify "Tomorrow" targets similar time
- [ ] 4.3 Verify contextual avoidance (e.g., no evening phone calls)
