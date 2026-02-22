## 1. Logic Implementation

- [x] 1.1 Implement `calculateDayStatus(totalDifficulty, totalHours)` in `utils/difficultyUtils.ts` (or similar) per the Design table.
- [x] 1.2 Implement `aggregateDayStats(events)` helper to produce the `DayBreakdown` structure (score, hours, breakdown map, penalties).

## 2. Components

- [x] 2.1 Create `DayStatusMarker.tsx` component that renders the visual indicator based on status color.
- [x] 2.2 Create `DaySummaryModal.tsx` component to display the `DayBreakdown` data.

## 3. Integration

- [x] 3.1 Update `ScheduleScreen.tsx` to use `aggregateDayStats` in the render loop.
- [x] 3.2 Integrate `DayStatusMarker` into the render header.
- [x] 3.3 Add interaction (onPress) to open `DaySummaryModal`.
- [x] 3.4 Wire up the modal with the calculated breakdown data.

## 4. Verification

- [x] 4.1 Verify colors change appropriately with varying event durations (check 3h+ orange rule).
- [x] 4.2 Verify colors change with difficulty scores.
- [x] 4.3 Verify modal popup shows correct event counts and penalty reasons.
