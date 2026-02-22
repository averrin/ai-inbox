## ADDED Requirements

### Requirement: Day Summary Breakdown Interaction
The system SHALL display a detailed breakdown of the day's metrics when the user taps on the day summary indicator.

#### Scenario: Tap Summary
- **WHEN** the user taps the day summary area (score/marker)
- **THEN** a modal or popup SHALL appear.

### Requirement: Breakdown Content
The breakdown visualization SHALL allow users to understand "why" the day has a certain score.

#### Scenario: Breakdown Data
- **WHEN** the breakdown modal is open
- **THEN** it SHALL display:
  - Total Difficulty Score
  - Total Deep Work Hours
  - A list of event types contributing to the score (e.g., "Deep Work: 3 events (12 pts)").
  - A list of bonuses/penalties applied (e.g., "Missed Lunch: +2", "Movable Overlap: +1").
