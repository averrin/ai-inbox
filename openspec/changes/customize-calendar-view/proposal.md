## Why

The current calendar library (`react-native-big-calendar`) limits the ability to visualize complex schedule information like reminders, free slots, and time ranges. To support these advanced visualization features (markers, zones, ranges), we need to extract and customize the calendar component directly in the codebase.

## What Changes

- **Extract Calendar**: Vendor the `react-native-big-calendar` library code into the project as a custom component.
- **Add Markers**: Implement colored symbol rendering for one-shot events/reminders (time-only visualization).
- **Add Zones**: Implement background rendering for time blocks (no title, transparent/striped) to indicate free slots or specific periods.
- **Add Ranges**: Implement vertical side-strips for overlapping time ranges.

## Capabilities

### New Capabilities
- `calendar-visualization`: Advanced rendering capabilities for the calendar view including markers, zones, and ranges.

### Modified Capabilities
- `calendar-configuration`: (If existing) might be touched to support configuring these new view elements.

## Impact

- **Dependencies**: `react-native-big-calendar` will be removed as a dependency and replaced by a local customized version.
- **UI Components**: `ScheduleScreen` and the new vendored `Calendar` component.
