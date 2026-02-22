## 1. Setup and Vendor

- [ ] 1.1 Extract/Copy `react-native-big-calendar` source code into `components/ui/calendar`.
- [ ] 1.2 Update `ScheduleScreen` to import from the new local calendar component.
- [ ] 1.3 Remove `react-native-big-calendar` from `package.json` and uninstall.
- [ ] 1.4 Verify the application builds and calendar functionality remains effectively unchanged (regression check).

## 2. Markers Implementation

- [ ] 2.1 Update calendar event type definitions to include `type: 'marker'` (or similar property).
- [ ] 2.2 Implement rendering logic in the calendar's event loop to detect markers.
- [ ] 2.3 Create a `MarkerComponent` that renders a fixed-size icon at the correct Y-offset.
- [ ] 2.4 Verify markers appear at the correct time without obstructing standard events.

## 3. Zones Implementation

- [ ] 3.1 Update event definitions to include `type: 'zone'`.
- [ ] 3.2 Implement a background rendering layer in the Day view for zones.
- [ ] 3.3 Ensure zones render with the specified background color/pattern and correct z-index (behind events).
- [ ] 3.4 Verify zones span the correct time range and width.

## 4. Ranges Implementation

- [ ] 4.1 Update event definitions to include `type: 'range'`.
- [ ] 4.2 Implement a "side-strip" rendering container within the Day view column.
- [ ] 4.3 Implement logic to stack or offset overlapping ranges.
- [ ] 4.4 Verify ranges appear as vertical bars alongside the main event column.
