## Why

The current day summary in the Schedule Screen provides raw metrics (difficulty score, deep work hours) but lacks immediate visual context. Users cannot quickly assess if a day is "healthy," "busy," or "overloaded" at a glance. Additionally, the components contributing to the score (e.g., missed lunch penalties vs. actual work duration) are opaque, making it hard for users to trust or understand the difficulty rating.

## What Changes

- Add a colored status marker to the day summary header.
- Implement color coding logic based on both duration and difficulty:
    - Green: Low load (<1h, <3 difficulty).
    - Gradient (Yellow -> Orange -> Red): Increasing load.
    - Special Rule: 3+ hours of deep work triggers warning colors (Orange/Red) regardless of difficulty.
- Add an interactive "Info" popup/modal when tapping the day summary.
- The popup will display:
    - Breakdown of the day's score by event type.
    - Specific reasons/bonuses for the difficulty score (e.g., "Missed Lunch", "Movable Event Overlap").

## Capabilities

### New Capabilities
- `day-status-visualization`: Rules for visual representation of day difficulty and status logic.
- `day-summary-breakdown`: Requirements for the breakdown interaction and data presentation.

### Modified Capabilities
- `lunch-management`: (Optional) Interaction with lunch penalties might be clarified, but effectively this is visualization of existing data, so arguably new capabilities. No core requirement change to lunch itself.

## Impact

- **UI**: Updates `ScheduleScreen` header, adds new `DaySummaryModal` component.
- **Logic**: New utility functions to calculate "Day Color" and aggregate breakdown stats beyond simple sum.
