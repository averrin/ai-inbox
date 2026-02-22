## ADDED Requirements

### Requirement: Render Markers
The system SHALL render "Marker" events as fixed-size icons at a specific time, regardless of duration, without occupying full column width.

#### Scenario: Display Marker
- **WHEN** the calendar renders a marker event (type='marker')
- **THEN** an icon is displayed at the vertical position corresponding to the start time
- **AND** the icon does not obstruct standard events

### Requirement: Render Zones
The system SHALL render "Zone" events as background blocks behind standard events, identifiable by color or pattern.

#### Scenario: Display Zone
- **WHEN** the calendar renders a zone event (type='zone')
- **THEN** a colored or patterned block is displayed covering the specified time range
- **AND** standard events are rendered on top of the zone

### Requirement: Render Ranges
The system SHALL render "Range" events as thin vertical bars on the side of the day column.

#### Scenario: Display Range
- **WHEN** the calendar renders a range event (type='range')
- **THEN** a vertical strip is displayed spanning the start and end time
- **AND** overlapping ranges are displayed side-by-side or offset to remain visible
