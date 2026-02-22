## Context

The calendar view currently displays time ranges as narrow colored strips (6px wide) on the left side of the calendar. These ranges are defined in `CalendarRange.tsx` and are visually distinct but lack labels. Users must click or hover to identify what each range represents.

React Native doesn't have built-in CSS transforms like `transform: rotate()` that work reliably across all platforms. We need to use the `transform` style property with the rotate option provided by React Native.

## Goals / Non-Goals

**Goals:**
- Display time range titles vertically (rotated 90 degrees) on the left side of each range
- Use the range's color for the title text to maintain visual consistency
- Ensure the title is positioned within the range bounds
- Make titles readable and non-intrusive

**Non-Goals:**
- Changing the width or positioning of the time range strips themselves
- Adding interactive features to the titles (clicking, hovering)
- Supporting custom title positioning or alignment options

## Decisions

### Use React Native Text with transform rotation
We'll use the `Text` component with `transform: [{ rotate: '90deg' }]` to create the vertical text. This provides cross-platform support for iOS and Android.

**Alternatives considered:**
- Using SVG for rotated text - more complex and unnecessary for simple text rotation
- Pre-rotating text in an image - not dynamic and doesn't respect color changes

### Position title within the narrow 6px range strip
The title will be rendered inside the existing `CalendarRange` component, positioned on the left portion of the 6px strip. We'll use absolute positioning within the range container.

**Alternatives considered:**
- Widening the range strip - would affect the visual design and overlap calculations
- Rendering title outside the range - would complicate z-index and positioning logic

### Use small font size (8-10px) for readability
Given the narrow width constraint, we'll use a small font size (8-10px) that remains readable when rotated.

**Alternatives considered:**
- Larger font - wouldn't fit within the 6px width constraint
- Adjustable font based on range height - adds complexity for minimal benefit

### Extract title from event data
The range events should have a `title` property that we'll display. This matches the existing event structure used elsewhere in the calendar.

## Risks / Trade-offs

**Risk: Text might be too small to read on some devices**  
→ Mitigation: Use 10px font size initially and test on actual devices. Can adjust based on feedback.

**Risk: Very short ranges might clip the title**  
→ Mitigation: Only show title if range height exceeds a minimum threshold (e.g., 40px minimum)

**Risk: Transform rotation might not work identically on iOS and Android**  
→ Mitigation: Test on both platforms during implementation. React Native's transform is well-supported.

**Trade-off: Adding text increases visual density**  
→ Accepted: The benefit of immediate identification outweighs the slight increase in visual noise.

## Migration Plan

Not applicable - this is an additive feature with no breaking changes or data migrations required.

## Open Questions

- Should we hide titles for very short ranges (< 1 hour)?
- Should title opacity match the range opacity, or be slightly transparent?
