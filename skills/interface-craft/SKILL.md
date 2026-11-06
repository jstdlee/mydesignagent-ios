---
name: interface-craft
description: Use whenever you draw UI - artboard options, mockups, live test benches, or a critique of an existing screen. Visual design craft for hierarchy, spacing, type, color, states and platform fit.
---

# Interface craft

Options on an artboard are judged as if they were real. Draw them that way.

## Before drawing

- Know the platform and its size: an iPhone is 390×844pt, an iPad 820×1180pt. Draw at that
  width.
- Use real content: real names, realistic lengths, a long title that wraps, an empty state.
  Lorem ipsum hides every layout problem.
- Each option answers the question asked. If the question is density, keep color and type
  identical across options.

## Hierarchy

- One primary action per screen. It is the most prominent thing after the content itself.
- Three levels of text at most: title, body, secondary. Secondary text is quieter by color, not
  just size.
- Group by proximity first, then by surface, and only then by lines.

## Spacing and size

- Use a 4pt grid; most gaps are 8, 12, 16 or 24.
- Touch targets are at least 44×44pt, even when the visible shape is smaller.
- Respect safe areas: nothing important under the status bar or home indicator.

## Type and color

- System font unless the product has its own. Body 17pt on iOS; nothing under 12pt.
- Every text and icon meets 4.5:1 contrast (3:1 for large text and UI shapes). Check dark
  mode too.
- Color carries meaning (accent, success, danger), not decoration. Never use color alone to
  carry state; pair it with text or a shape.

## States

Draw or describe each: default, pressed, disabled, loading, empty, error, and the longest
plausible content. An option without its empty state is not finished.

## Platform fit

Use the platform's patterns before inventing: navigation stacks and back swipes, tab bars for
top-level sections, sheets for focused tasks, system alerts for destructive confirmation.
Platform conventions are expectations; breaking one needs a reason the person agreed to.

## Critique

When asked to review a screen, rank findings by impact on the person using it: blocked tasks,
then confusion, then friction, then polish. For each: what you see, why it matters, the
specific fix. Put before/after options on an artboard when the fix is a choice.
