# Day Summary Status & Breakdown Walkthrough

This update introduces a visual "Day Status" indicators and a detailed breakdown modal to the Schedule Screen.

## Changes

### 1. Day Status Logic
We implemented a robust status calculation based on **Total Difficulty** and **Deep Work Hours**.

**Status Levels:**
- **Healthy (Green)**: Low load (< 1h deep work, < 3 diff).
- **Moderate (Yellow)**: Medium load.
- **Busy (Orange)**: High load (3-5h deep work).
- **Overloaded (Red)**: Excessive load (> 5h deep work or > 9 diff).

*Note: 3+ hours of Deep Work triggers at least "Busy" status regardless of difficulty score.*

### 2. UI Updates
- **Day Status Marker**: A colored dot indicator added to the Schedule Screen header next to the deep work duration.
- **Interactive Header**: Tapping the header (Day Score / Deep Work area) now opens the **Day Summary Modal**.

### 3. Day Summary Modal
A new modal provides transparency into the day's score:
- **Big Metrics**: Total Score and Deep Work Duration.
- **Composition**: Breakdown of events by type (Count and Score contribution).
- **Score Factors**: List of specific penalties or bonuses applied (e.g., "Lunch Issues", "Focus Range Bonus").

## Verification

### Automated Checks
- `calculateDayStatus` unit logic follows the specified matrix.
- `aggregateDayStats` correctly sums difficulty and counts events.

### Manual Verification
1. Open Schedule Screen.
2. Navigate to a day with:
   - **No events**: Should be Green (Healthy).
   - **~2h Deep Work**: Should be Yellow (Moderate).
   - **~4h Deep Work**: Should be Orange (Busy).
   - **>5h Deep Work**: Should be Red (Overloaded).
3. Tap the header.
4. Verify the modal appears and shows correct counts and breakdown.
5. Verify that "Missed Lunch" penalty appears in "Score Factors" if applicable.
