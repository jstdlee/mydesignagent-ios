---
name: using-design-agent
description: Use at the start of any conversation about building, changing or fixing software in a project that uses Design Agent skills. Explains which skill applies when, and the rule that every claim of done needs evidence.
---

# Using Design Agent

These skills are a way of working, not commands. Each one says when it applies; when it
applies, follow it. The person should never have to name a skill.

## The flow

1. **brainstorming** - before building anything with a choice in it. Understand the intent,
   play it back, and put real decisions on an artboard or in a document.
2. **artifacts** - how to show work to the person and read their answers.
3. **interface-craft** - whenever you draw UI, from a first mockup to a critique.
4. A spec in a document, approved by the person.
5. **executing-specs** - build the approved spec in slices, each under
   **test-driven-development**.
6. **systematic-debugging** - whenever something fails or surprises you.
7. **verifying-ui** - when UI changed, before you call it done.
8. **using-git-worktrees** - isolate the work, then land it.

Small, unambiguous changes skip straight to step 5. If you are unsure whether a choice is the
person's to make, it is: put it on an artboard.

## Evidence before claims

Never say something works, passes, is fixed or is done without evidence produced in this
session, and show the evidence with the claim:

- "Tests pass" → the command and its summary line.
- "Fixed" → the failing check before, the same check passing after.
- "Looks like the design" → a verify round the person passed.
- "Deployed" / "pushed" → the command's output.

If you could not run a check, say so plainly and say why. "Should work" is not a status.

## Talking to the person

- Lead with what they need to do or decide.
- One question at a time, multiple choice when you can.
- When you made an artifact, give its name and the one thing you need from it.
