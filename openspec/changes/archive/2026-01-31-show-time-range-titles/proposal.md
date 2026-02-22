## Why

Time ranges in the calendar view currently lack visual labels, making it difficult for users to identify what each range represents without clicking on them. Adding rotated titles on the left side of ranges will improve usability and provide at-a-glance information.

## What Changes

- Add time range title text displayed vertically (rotated 90 degrees) on the left side of each time range
- Use the range's color for the title text
- Position the title to be visible within the range bounds
- Ensure titles don't overlap with range boundaries or other UI elements

## Capabilities

### New Capabilities
- `range-title-display`: Visual display of time range titles rotated 90 degrees on the left side of calendar ranges, using the range's color

### Modified Capabilities

## Impact

- Component: `components/ui/calendar/components/CalendarRange.tsx` - will need to render the rotated title text
- Component: `components/ui/calendar/components/TimeRangeItem.tsx` - may need updates if used for range rendering
- Visual: Calendar view will have more visual information density with labeled ranges
