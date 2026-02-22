## Context

The current calendar interaction is primarily based on tapping existing events or nav buttons. Adding a direct interaction layer on the calendar matrix will improve accessibility and ease of use for scheduled tasks.

## Goals / Non-Goals

**Goals:**
- Provide clear visual feedback when a long-press is initiated.
- Allow precise time selection via dragging after the long-press activates.
- Offer immediate shortcuts for adding events/reminders at the selected time.

**Non-Goals:**
- Supporting multi-day selection in this phase.
- Editing existing events via dragging (reserved for future work).

## Decisions

### 1. Gesture Handling Layer
**Choice**: Use `GestureDetector` from `react-native-gesture-handler` (Gesture API v2).
**Rationale**: It provides the best performance and allows combining gestures (LongPress + Pan) more naturally than the legacy `PanGestureHandler`.
**Alternative**: Wrapping cells in `TouchableHighlight`. *Why rejected*: Doesn't support dragging across multiple hourly cells smoothly.

### 2. Implementation logic
**Choice**: Wrap the entire day column grid in a single `GestureDetector`.
**Rationale**: Centralizing gesture logic simplifies coordinate calculation and ensures the marker can move smoothly across the entire vertical space.

### 3. Visual Marker
**Choice**: A `Reanimated` `Animated.View` with absolute positioning.
**Rationale**: Offloading animation to the UI thread ensures the marker follows the finger with zero lag, even during high JS thread load.

### 4. Action Menu UI
**Choice**: A floating absolute overlay positioned relative to the marker.
**Rationale**: Contextual proximity reduces finger travel distance for the final selection.

## Risks / Trade-offs

- **[Risk]** Coordination with ScrollView scrolling → **[Mitigation]** Use `Gesture.Pan()` with `activateAfterLongPress`. Once the gesture is active, it will hijack the touch from the ScrollView.
- **[Risk]** Coordinate mapping for multiple columns (3-day/week view) → **[Mitigation]** Calculate column index based on `translateX` and `dateRange.length`.
