## MODIFIED Requirements

### Requirement: Flattened Settings Hierarchy
The system SHALL organize all settings categories at the top level, removing intermediate grouping screens like "Tools".

#### Scenario: Root Settings List
- **WHEN** user views the root Settings screen
- **THEN** "Calendars" and "Event Types" are listed directly
- **AND** the "Tools" category is NOT visible

### Requirement: Remove Tools Screen
The system SHALL NOT provide a separate "Tools" navigation destination.

#### Scenario: No Tools Navigation
- **WHEN** user navigates through settings
- **THEN** there is no option to enter a "Tools" submenu
