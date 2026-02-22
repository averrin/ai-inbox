## Context

The system currently calculates a "Day Score" and "Deep Work Hours" in `ScheduleScreen.tsx` but displays them simply as text. We need to upgrade this to a visual system using colored indicators and provide a detailed breakdown view.

## Goals / Non-Goals

**Goals:**
- Implement a robust `calculateDayStatus(totalDifficulty, totalHours)` function.
- Create visual indicator component (`DayStatusMarker`) reflecting this status.
- Implement an info modal for detailed score breakdown (`DaySummaryInfoModal`).

**Non-Goals:**
- Changing the underlying difficulty calculation logic for *individual* events (this is about aggregation).

## Decisions

### Day Status Logic
We will implement a logic that weighs hours heavily.

| Status Level | Color | Condition (Hours) | Condition (Diff) |
| :--- | :--- | :--- | :--- |
| **Healthy** | Green (#22c55e) | < 1h | < 3 |
| **Moderate** | Yellow (#eab308) | 1h - 3h | 3 - 6 |
| **Busy** | Orange (#f97316) | 3h - 5h | 6 - 9 |
| **Overloaded** | Red (#ef4444) | > 5h | > 9 |

*Correction based on User Request:*
"3+ hours even with low difficulty makes day orange."
So:
- If Hours >= 3: Minimum Status is Orange (Busy).
- If Hours >= 5: Minimum Status is Red (Overloaded).

Modified Logic:
1. Determine Base Level from Hours:
   - < 1h: Level 0
   - 1-3h: Level 1
   - 3-5h: Level 2 (Orange) - *Hard floor*
   - > 5h: Level 3 (Red) - *Hard floor*
2. Determine Level from Difficulty:
   - < 3: Level 0
   - 3-6: Level 1
   - 6-9: Level 2
   - > 9: Level 3
3. Final Status = Max(HourLevel, DifficultyLevel).

Colors:
- Level 0: Green (50-200 range of emerald/green)
- Level 1: Yellow/Lime
- Level 2: Orange
- Level 3: Red/Rose

### Visual Representation
- A small colored dot or "pill" next to the date/score.
- Located in the `DaySummary` header section of `ScheduleScreen`.

### Breakdown Data Structure
We need to aggregate data during the render loop in `ScheduleScreen` (or a helper hook).
Object structure:
```typescript
interface DayBreakdown {
  totalScore: number;
  deepWorkMinutes: number;
  eventCount: number;
  breakdown: {
    [type: string]: { count: number; score: number }; // e.g., 'Work', 'Meeting'
  };
  penalties: {
    reason: string;
    points: number;
    count: number;
  }[];
}
```

## Risks / Trade-offs

- **Performance**: Aggregating breakdown data inside the `renderHeader` or a fast-firing hook might be expensive if not memoized correctly. *Mitigation*: Use `useMemo` strictly dependent on `events` array.
