## ADDED Requirements

### Requirement: Detect focus time periods
The system SHALL automatically detect periods where multiple non-zero difficulty events are clustered with minimal gaps between them.

#### Scenario: Multiple events with small gaps
- **WHEN** there are 3 events with difficulty > 0, each 20 minutes apart, totaling 90 minutes duration
- **THEN** system creates a focus time range from the first event start to the last event end

#### Scenario: Events with large gaps
- **WHEN** there are events with difficulty > 0 but gaps between them exceed 15 minutes
- **THEN** system does not create a focus time range for that period

#### Scenario: Short total duration
- **WHEN** clustered events total less than 60 minutes
- **THEN** system does not create a focus time range

#### Scenario: Zero difficulty events
- **WHEN** clustered events have difficulty = 0
- **THEN** system does not include them in focus time calculation

### Requirement: Display focus time range
The system SHALL display detected focus time periods as a bright red vertical bar on the calendar.

#### Scenario: Focus period active
- **WHEN** a focus time period is detected
- **THEN** system renders a red range overlay from start to end time

#### Scenario: Multiple focus periods in one day
- **WHEN** multiple separate focus periods are detected on the same day
- **THEN** system renders each as a separate red range

####  Scenario: No focus periods
- **WHEN** no events meet the focus time criteria
- **THEN** system does not render any dynamic focus ranges

### Requirement: Range boundaries based on actual events
The system SHALL set focus range duration from the start time of the first qualifying event to the end time of the last qualifying event in the cluster.

#### Scenario: Exact timing match
- **WHEN** first event starts at 09:00 and last event ends at 12:00
- **THEN** focus range SHALL span from 09:00 to 12:00

#### Scenario: Events of varying duration
- **WHEN** events have different durations but meet clustering criteria
- **THEN** focus range SHALL encompass the complete time span

### Requirement: Use gap threshold of 15 minutes
The system SHALL consider events as part of the same focus cluster only if the gap between consecutive events is 15 minutes or less.

#### Scenario: 15-minute gap
- **WHEN** gap between events is exactly 15 minutes
- **THEN** events are considered part of the same cluster

#### Scenario: 16-minute gap
- **WHEN** gap between events exceeds 15 minutes
- **THEN** events are considered separate clusters

### Requirement: Minimum total duration of 60 minutes
The system SHALL only create a focus range when the total duration of clustered events is greater than 60 minutes.

#### Scenario: Exactly 60 minutes
- **WHEN** clustered events total exactly 60 minutes
- **THEN** system does not create focus range

#### Scenario: 61 minutes
- **WHEN** clustered events total 61 minutes
- **THEN** system creates focus range

### Requirement: Single-day analysis
The system SHALL limit focus time detection to events within a single calendar day and SHALL NOT create ranges spanning multiple days.

#### Scenario: Events crossing midnight
- **WHEN** events before and after midnight meet clustering criteria
- **THEN** system creates separate focus ranges for each day

#### Scenario: Multi-day event
- **WHEN** an event spans multiple days
- **THEN** system considers only the portion within each individual day for focus detection
