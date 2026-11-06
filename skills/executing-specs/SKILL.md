---
name: executing-specs
description: Use after the person approved a spec and wants it built in this session. Slices the spec into tasks, builds each under test-driven development, keeps a ledger of judgment calls that survives context compaction, gets one fresh review, and reports with evidence.
---

# Executing specs

## 1. Slice

Read the approved spec document end to end. Split it into tasks that each:

- deliver one observable behavior,
- can be tested on their own,
- take under an hour.

Order them so the earliest tasks unblock the most. Write the list at the top of a ledger file,
`.designagent/ledger/<feature>.md`, with a checkbox per task.

## 2. Build each task

For each task, in order:

1. Follow **test-driven-development**: a failing test, the smallest change that passes it, then
   refactor.
2. Run the project's fast checks (lint, types, the tests near the change).
3. Commit with a message that names the behavior, not the files.
4. Tick the task in the ledger.

## 3. Keep the judgment-call ledger

Every time the spec does not decide something and you do - a name, an edge case, a default, a
trade-off - append it to the ledger under **Judgment calls**: what you decided, the
alternatives, why. The ledger is the memory that survives a context reset: on resuming, read
it before anything else.

If a call changes what the person sees or would surprise them, stop and ask instead (a comment
on the spec document, or an artboard if it is visual).

## 4. One fresh review

When every task is done, review the whole diff once as if you had not written it, or have a
fresh agent do it: correctness first, then spec coverage (every spec line maps to code and a
test), then simplicity. Fix what it finds.

## 5. Report

- What was built, as behaviors.
- Evidence: the test command and its summary, the checks you ran.
- The judgment calls, so the person can overrule any of them.
- What remains, if anything, and why.

If UI changed, run **verifying-ui** before reporting done.
