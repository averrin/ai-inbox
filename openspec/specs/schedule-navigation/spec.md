## ADDED Requirements

### Requirement: Display Date Ruler
The system SHALL display a horizontal date ruler in the calendar header, showing a range of dates ending with or centering on the selected date.

#### Scenario: Default view
- **WHEN** user views the schedule screen
- **THEN** the date ruler is visible in the header
- **AND** the current selected date is highlighted.

### Requirement: Header Swipe Navigation
The system SHALL allow users to swipe left and right on the header to navigate between dates.

#### Scenario: Swipe Left
- **WHEN** user swipes left on the date ruler
- **THEN** the selected date moves forward (next day or page)
- **AND** the displayed events update.

#### Scenario: Swipe Right
- **WHEN** user swipes right on the date ruler
- **THEN** the selected date moves backward.

### Requirement: Sequential Navigation Buttons
The system SHALL provide "Next" and "Previous" buttons in the header to navigate date-by-date.

#### Scenario: Click Next
- **WHEN** user taps the "Next" button (chevron right)
- **THEN** the selected date advances by one day.

#### Scenario: Click Previous
- **WHEN** user taps the "Previous" button (chevron left)
- **THEN** the selected date goes back by one day.
