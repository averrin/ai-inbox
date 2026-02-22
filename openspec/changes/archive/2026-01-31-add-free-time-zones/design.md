## Context

Users want to see "Free Time" or recovery zones on their calendar. These are defined as periods of at least 60 minutes containing no events with difficulty 1 or higher. This complements the "Focus Time" feature (high difficulty clusters).

## Goals / Non-Goals

**Goals:**
- Detect time periods > 60m with no difficulty >= 1 events.
- Treats events with difficulty 0 (or undefined) as "non-breaking" for these zones.
- Render these periods as pale green, stripped background zones.
- Support single-day analysis (clamped to day boundaries).

**Non-Goals:**
- User configuration of "Free Time" definition.
- Excluding sleep time (unless events exist). Will assume 00:00-24:00 range for detection references.

## Decisions

### Decision 1: Detection Logic
**Chosen**: Inverse of difficulty detection.
- Identify all "Busy" blocks (difficulty >= 1).
- Identify gaps between these blocks.
- If gap > 60m, create a zone.
- Include 00:00 to first busy block, and last busy block to 24:00.
**Rationale**: 
- Efficient and covers the user requirement "without events with 1+ difficulty".
- Difficulty 0 events simply sit on top of the zone.

### Decision 2: Rendering approach
**Chosen**: `CalendarZone` with patterned background.
**Rationale**:
- `CalendarZone` is designed for background areas.
- Needs a new style prop or update for "striped" appearance (SVG pattern or CSS gradient).
- On React Native, stripes are tricky without SVGs.
- Alternative: Simple pale green with 50% opacity if stripes are too complex to implement quickly without deps.
- **Refinement**: Will attempt striped using `repeating-linear-gradient` logic if on Web, or SVG on mobile. 
- *Constraint Check*: Project uses `expo` / `react-native`. `react-native-svg` might be available.
- If not, will stick to solid pale green (maybe dashed border?) or simple solid color with low opacity.
- **Decision**: Pale green solid with low opacity is safest MVP. User asked for "stripped" (striped).
- Will try to emulate stripes with a custom view or image if possible, but fallback to solid if complex.
- Actually, `CalendarZone` likely renders a `View`. We can use `dashed` border? No.
- We will look at `CalendarZone.tsx` during implementation.

### Decision 3: Data Flow
**Chosen**: Calculate in `ScheduleScreen` -> `allEvents` array with `type: 'zone'`.
**Rationale**: Consistency with `Focus Time` ranges implementation.

## Risks / Trade-offs

**Risk**: "Free Time" at 3 AM.
→ **Mitigation**: User can ignore it. No sleep schedule data available to filter it out intelligently yet.

**Risk**: Stripes performance/complexity.
→ **Mitigation**: Fallback to solid color if needed.
