## ADDED Requirements

### Requirement: Range title must be displayed vertically
The calendar range component SHALL display the range title text rotated 90 degrees clockwise on the left side of the range.

#### Scenario: Title is visible on range
- **WHEN** a time range is displayed in the calendar view
- **THEN** the range title SHALL appear vertically on the left edge of the range

#### Scenario: Title uses range color
- **WHEN** a time range is displayed with a specific color
- **THEN** the title text SHALL be rendered in the same color as the range

### Requirement: Title must be positioned within range bounds
The title SHALL be positioned within the horizontal and vertical bounds of the range to avoid overlapping with other UI elements.

#### Scenario: Title fits within range height
- **WHEN** a time range has sufficient height to display the title
- **THEN** the title SHALL be fully visible within the range's vertical bounds

#### Scenario: Title is left-aligned
- **WHEN** a time range is rendered
- **THEN** the title SHALL be positioned on the left side of the range with appropriate padding

### Requirement: Title text must be readable
The title text SHALL use appropriate font size and styling to ensure readability when rotated.

#### Scenario: Font size is appropriate
- **WHEN** a time range title is displayed
- **THEN** the text SHALL use a font size that is readable at 90-degree rotation

#### Scenario: Text contrast is maintained
- **WHEN** a time range title is displayed against the calendar background
- **THEN** the text SHALL have sufficient contrast for readability
