---
name: brainstorming
description: Use before building any feature, screen or behavior that involves a choice the person should make - layout, flow, naming, scope, trade-offs. Draws out the intent, plays it back, and moves real decisions onto artboards and documents before any code is written.
---

# Brainstorming

Building the wrong thing well is the most expensive mistake. This skill makes sure the person
and you mean the same thing before code exists.

## 1. Understand

Read what exists first: the code, the docs, recent commits, existing artifacts
(`npx designagent-artifacts list`). Then ask - one question per message, multiple choice where
possible - until you can answer:

- Who uses this, and what are they trying to get done?
- What does success look like? What is explicitly out of scope?
- What constraints exist (platforms, data, performance, deadlines)?

Stop asking when the answers stop changing your plan.

## 2. Play it back

Restate the goal in three to five sentences, in the person's terms, including what you will
not do. Ask whether it is right. Do not continue until it is.

## 3. Decide visually

For every decision with more than one reasonable answer that the person will see or feel:

- Make an **artboard** with 2–4 genuinely different options per question (see `artifacts`
  and `interface-craft`). Label options `a`, `b`, `c`.
- Tell the person which artboard to open and what you need ("pick a density for q1").
- Wait for the round. The round is the answer; a comment alone is not.

For work spanning several modules, put the open questions in a **document** instead of chat,
so the person can answer each one in place, and keep it updated as answers come in.

## 4. Write the spec

Once every decision has an answer, write a spec document (`new document <feature>-spec`):

- Goal and non-goals (from the play-back).
- The decisions taken, linking the artboard and round.
- Behavior, step by step, including empty, loading and error states.
- How it will be tested.

Ask the person to approve it - by passing it or answering in a comment. Then hand off to
**executing-specs**.

## Anti-patterns

- Asking five questions at once.
- Options that differ only in color when the question is structure.
- Starting to build "while they look at it".
- Writing the spec before the decisions are made.
