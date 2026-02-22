## Context

The current `ScheduleScreen` uses `react-native-big-calendar` with a minimal custom header. The navigation is limited to jumping to "today" or picking a date via a modal (implied). Users want more fluid navigation directly in the header.

## Goals / Non-Goals

**Goals:**
- Create a `DateRuler` component to display a range of dates.
- Allow selecting a date by tapping on the ruler.
- Allow navigating the ruler and the selected date via swiping.
- Provide explicit Next/Previous buttons for single-day navigation.

**Non-Goals:**
- modifying the internal logic of `react-native-big-calendar`.
- complex month/year views in the ruler (focus on week/day strip).

## Decisions

### Custom `DateRuler` Component
We will build a custom component `components/DateRuler.tsx` to handle the date display.
- **Why**: Existing libraries may not match the specific "Rich Aesthetics" and dark mode requirements of the app easily. A custom component gives full control over animations and styling.
- **Implementation**: A horizontal `FlatList` or `ScrollView` showing, for example, 3-7 days centered on the selected date.

### Navigation Logic
- **Swipe**: Swiping the *header* (DateRuler) will scroll the dates. Swiping the *calendar content* is handled by `BigCalendar` (usually). We will add swipe gesture detection to the header area to switch dates.
- **Buttons**: Chevron icons to increment/decrement the `selectedDate` by 1 day.

### State Management
- `ScheduleScreen.tsx` owns the `date` state.
- `DateRuler` is a controlled component: `value={date}` `onChange={setDate}`.

## Risks / Trade-offs

- **Performance**: Formatting dates and handling gestures needs to be efficient to avoid jank.
- **Space**: A date ruler takes more vertical space than a simple text header. We need to ensure the calendar area remains usable on smaller screens.
