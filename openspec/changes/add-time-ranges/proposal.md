## Why

Users need the ability to define recurring time blocks (like working hours, gym slots, or specific availability) directly on their calendar to better visualize and structure their day. Currently, there is no way to represent these background/contextual time ranges distinct from specific events.

## What Changes

- Add a new data model for `TimeRange` (title, start/end time, active days, color).
- Create a UI for users to manage (create, list, edit, delete) these time ranges.
- Render these time ranges visually on the calendar view, distinct from standard events.
- Ensure time ranges support recurring patterns (days of the week).

## Capabilities

### New Capabilities
- `time-ranges`: Manages the definition, storage, and retrieval of recurring time blocks (ranges) with properties like title, time window, active days, and color.

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->

## Impact

- **Database/Storage**: Schema update to store time ranges.
- **Frontend/UI**: New management screens for time ranges; updates to `CalendarBody` to render these ranges.
- **State Management**: New stores/hooks to fetch and manage time range data.
