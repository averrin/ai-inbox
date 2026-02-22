## Context

The calendar currently supports user-defined time ranges (Morning, Work, Evening, etc.) that are manually configured. Events have a difficulty property that indicates cognitive load. Users need automatic detection of periods where high-difficulty work is clustered together to help with energy management and planning.

Current state:
- Time ranges are manually defined in settings
- Events have difficulty ratings (0-5)
- Calendar renders static ranges and events
- No automatic analysis of work patterns

## Goals / Non-Goals

**Goals:**
- Automatically detect "focus time" periods based on event clustering
- Provide clear visual feedback (bright red range) when focus periods are active
- Use existing range rendering infrastructure
- Calculate periods dynamically as calendar data changes

**Non-Goals:**
- Modifying user-defined time ranges
- Adding configuration UI for focus detection parameters (will use hardcoded defaults)
- Historical analysis or trend tracking
- Notifications or alerts about focus time

## Decisions

### Decision 1: Detection Algorithm
**Chosen**: Linear scan with gap tracking  
**Rationale**: Simple, predictable, and adequate for typical calendar density  
**Alternatives**: 
- Event graph clustering: Overly complex for the use case
- Time window sliding: Less intuitive for users expecting end-to-end coverage  

### Decision 2: Where to Calculate
**Chosen**: In `ScheduleScreen.tsx` before passing to calendar  
**Rationale**:  
- Keeps `CalendarBody` presentation-only
- Easy access to all event data
- Can use existing event filtering logic
**Alternatives**:
- Inside `CalendarBody`: Would mix presentation and business logic
- Separate utility module: Adds indirection without clear benefit

### Decision 3: Integration with Existing Ranges
**Chosen**: Pass as separate range object with special styling  
**Rationale**:  
- Reuses existing range rendering (`CalendarRange` component)
- Distinguishes from user ranges via color property
- No UI changes needed in range components  
**Alternatives**:
- New component type: Redundant with `CalendarRange`
- Overlay layer: More complex z-index management

### Decision 4: Defaults
- Gap threshold: 15 minutes
- Minimum total duration: 60 minutes  
- Difficulty threshold: >0 (any non-zero difficulty counts)
- Color: `#FF0000` (bright red)

## Risks / Trade-offs

**Risk**: Focus ranges recalculating frequently on calendar interactions  
→ **Mitigation**: Use `useMemo` with event array dependency

**Risk**: Overlapping with user-defined ranges causing visual confusion  
→ **Mitigation**: Bright red color distinct from user range colors; current range offset logic will handle positioning

**Trade-off**: Hardcoded thresholds vs. user configuration  
→ Starting with hardcoded defaults keeps scope manageable; can add settings later if needed

**Risk**: Events spanning multiple days could create unexpected ranges  
→ **Mitigation**: Limit detection to single-day analysis (don't cross day boundaries)
