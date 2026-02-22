## Context

We rely on `react-native-big-calendar` for our Schedule screen. However, we need to implement "Markers" (icons for reminders), "Zones" (background patterns for free slots), and "Ranges" (side strips for overlapping periods). The library's current customization hooks are insufficient for these specific visualizations without complex hacks or patch-package.

## Goals / Non-Goals

**Goals:**
- Replace `react-native-big-calendar` dependency with a local vendored version (likely copied into `components/big-calendar` or similar).
- Implement rendering logic for Markers (time-only icon), Zones (background), and Ranges (side strip).
- Maintain existing event rendering functionality.

**Non-Goals:**
- Rewriting the entire calendar logic from scratch (we will base it on the existing library).
- Adding drag-and-drop support (unless already supported and easy to keep).

## Decisions

### 1. Vendoring Strategy
We will copy the source code of `react-native-big-calendar` into `components/ui/calendar` (or similar). This allows full control over the `renderEvent`, grid layout, and touch handling logic. We will remove the npm dependency.

### 2. Data Model Extensions
The calendar component will need to accept new props or an extended event interface to support the new types:
- **Markers**: Events with a specific flag (e.g., `type: 'marker'`) or a separate prop `markers`. They have a `start` time but effectively 0 duration for visualization purposes (rendered as a fixed-size icon at the time).
- **Zones**: Events with `type: 'zone'`. They are rendered behind standard events (z-index) and often full width or specific column width. Visuals: transparent color or pattern.
- **Ranges**: Events with `type: 'range'`. Rendered as a thin vertical bar on the left/right of the day column.

### 3. Rendering Implementation
- **Markers**: Modified `Event` component or specific rendering loop that overlays icons at absolute Y positions based on time.
- **Zones**: Rendered likely in the background container of the Day view, before events are rendered.
- **Ranges**: Rendered in a separate container overlaying the grid but potentially under the main events, or alongside them.

## Risks / Trade-offs

- **Risk**: Maintenance burden. We lose automatic updates from the upstream library.
  - **Mitigation**: The library seems stable/mature. We only need specific features.
- **Risk**: Complexity in layout calculation (overlap handling).
  - **Mitigation**: Re-use the existing layout engine for standard events. Handle Markers/Ranges with simplified logic (since Markers don't "collide" in the same way, and Ranges are just side strips).

## Migration Plan

1.  Copy library code to `components/vendor/react-native-big-calendar`.
2.  Update `ScheduleScreen` to import from local path.
3.  Uninstall `react-native-big-calendar`.
4.  Verify parity.
5.  Implement new features one by one.
