## 1. Detection Logic

- [x] 1.1 Implement `detectFreeTimeZones` helper in `ScheduleScreen.tsx` that identifies gaps > 60m between difficulty >= 1 events.
- [x] 1.2 Update `ScheduleScreen` to use this helper and merge resulting objects (with `type: 'zone'`) into the calendar events array.
- [x] 1.3 Ensure logic correctly handles start-of-day (00:00) and end-of-day (23:59) boundaries.

## 2. Visualization

- [x] 2.1 Verify `CalendarBody` correctly segregates and renders `type: 'zone'` events.
- [x] 2.2 Update or configure `CalendarZone` component to render "pale green" background.
- [x] 2.3 Implement "striped" pattern if possible (using repeating gradient or SVG), otherwise fallback to solid pale green.

## 3. Verification

- [x] 3.1 Verify scenario: Large gap between difficult events creates a zone.
- [x] 3.2 Verify scenario: Difficulty 0 event inside a gap does not break the zone.
- [x] 3.3 Verify scenario: Zone appears visually distinct (green) and sits behind events.

## 4. Refinements (Work Zones & Stripes)

- [x] 4.1 Update `TimeRangeDefinition` in `interfaces.ts` with `isWork?: boolean`.
- [x] 4.2 Update `TimeRangeForm.tsx` to include "Is Work Range?" toggle.
- [x] 4.3 Update `ScheduleScreen.tsx` to fetch `ranges` from store.
- [x] 4.4 Update `detectFreeTimeZones` to intersect free time with `isWork=true` ranges.
- [x] 4.5 Implement striped background in `CalendarZone.tsx` using `expo-linear-gradient`.

## 5. Boundary Logic Verification

- [x] 5.1 Verify that detection logic correctly identifies free time at the start and end of work ranges (Intersection Logic).
- [x] 5.2 Add debug logs to confirm boundary intersections are occurring as expected.
