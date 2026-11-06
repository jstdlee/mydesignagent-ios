---
name: systematic-debugging
description: Use when anything fails, behaves unexpectedly, or a test is flaky. Find the root cause with evidence before changing code; never patch symptoms by guessing.
---

# Systematic debugging

Guessing is slow and leaves the real bug in place. Work in four phases and do not skip ahead.

## 1. Reproduce

- Get the exact error, output or behavior, and the exact steps.
- Make it happen on demand, ideally with one command. A flaky failure: run it in a loop and
  count.
- If you cannot reproduce it, you cannot know you fixed it. Gather more information instead.

## 2. Locate

- Read the whole error and stack trace; the first frame in your code is a lead, not an answer.
- Check what changed: `git log`, `git diff`, dependency updates, environment.
- Narrow down: bisect commits, comment out halves, add logging at boundaries between
  components. Compare with a working case.

## 3. Explain

State a hypothesis that explains every symptom: "X happens because Y, which is why Z also
shows". Test it with one targeted check whose outcome you predict beforehand. If the
prediction fails, the hypothesis is wrong - form a new one; do not stack fixes.

## 4. Fix

- Write a test that fails because of the root cause (see **test-driven-development**).
- Fix the cause, not the place the symptom appeared.
- Run the test, the neighbours, and the original reproduction.
- Look for the same mistake elsewhere.

## Stop signs

- Third attempted fix without a confirmed hypothesis: stop, go back to phase 2, and tell the
  person what you know and do not know.
- "It works now" without knowing why: it does not work; you moved the bug.
