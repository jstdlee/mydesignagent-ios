---
name: test-driven-development
description: Use when implementing any behavior or fixing any bug. Red, green, refactor - a test that fails for the right reason before the code that makes it pass.
---

# Test-driven development

## The cycle

1. **Red.** Write one test for the next behavior, through the public interface, the way a
   caller uses it. Run it. It must fail, and fail because the behavior is missing - not
   because of a typo, an import or a setup error. Read the failure message to be sure.
2. **Green.** Write the smallest change that makes it pass. Run it. Run the neighbouring tests
   too.
3. **Refactor.** With everything green, improve names and structure. Run the tests again.

Then the next behavior.

## Rules

- No production code without a failing test that needs it. If you wrote code first, delete it
  and start from the test.
- One behavior per test; the test name says the behavior ("rejects a verdict without a note").
- Test what a user or caller can observe. For UI, press, type and scroll like a person; do not
  call internals.
- A bug fix starts with a test that reproduces the bug and fails.
- Never weaken, skip or delete a test to get green. If a test is wrong, say why and fix it
  deliberately, in its own commit.
- Keep the suite fast enough to run on every change.

## When it is hard to test

Difficulty testing is design feedback: the code depends on too much. Introduce a seam (pass
the clock, the network, the store in) rather than skipping the test.
