---
name: nightwork-ai-logic-checker
description: Use this skill on every business-logic, financial-calculation, workflow-rule, state-transition, aggregation, or data-transformation change in Nightwork. Validates that the LOGIC makes sense — not just that it executes. Triggers on changes to invoice/draw/CO/PO/budget calculations, status transitions, AI parsing/scoring/routing, payment-schedule math, lien-release rules, draw revisions, recalculations, and any step where construction-domain meaning matters. Asks — "given this input, what should the output be? Does the actual output match? Are edge cases handled? Does it make construction-domain sense?"
---

# Nightwork AI logic checker

Type checks pass when types match. Tests pass when assertions hold. Neither catches "the math is wrong" or "this transition is impossible" or "no PM in the field would ever click that." This skill closes that gap by reasoning about the logic against construction-domain reality.

## When this skill activates

- Any change to a financial calculation (cents math, sums, percentages, allocations).
- Any change to a status transition (invoice, draw, CO, PO, proposal, lien release).
- Any change to AI parsing, scoring, or confidence routing.
- Any change to a recalculation or aggregation (`total_to_date`, `previous_applications`, `balance_to_finish`, `co_running_total`, `jobs.approved_cos_total`).
- Any change to draw generation logic, G702/G703 line item math, or PCCO log math.
- Any change to payment schedule logic (received-by date → payment date).
- Any change to data import / workflow trigger semantics.
- Any change to permissions/role gates.

## Reasoning protocol

For each change, run ALL FOUR checks. Document each finding with severity (BLOCKING / WARNING / NOTE).

### 1. Forward reasoning

- Pick a concrete realistic input (use Drummond fixtures when possible).
- Trace through the code by hand. What is the output?
- Does that output make sense given the input?
- Example: "Invoice for $50,000, PO #123 has $40,000 remaining. Approve invoice. What happens to PO balance? Should be -$10,000 overage. Does the code show that? Does the UI surface the overage to the PM?"

### 2. Edge-case audit

For every code path, enumerate edge cases. At minimum check:

- **Zero values** — `total_amount = 0`, `qty = 0`, `rate = 0`. What happens?
- **Negative values** — credit memos, adjustments. Does the math still work?
- **Empty collections** — invoice with zero line items, draw with no invoices, job with no budget lines.
- **Boundaries** — exactly equal to the cutoff (received on the 5th vs on the 6th), exactly equal to the budget, exactly $0 remaining.
- **Concurrent edits** — two PMs approve at the same time. Optimistic locking handle it?
- **Soft-deleted upstream** — vendor is soft-deleted but invoices reference it. Does join still work? Should it?
- **Revisions** — invoice already in a submitted draw. What happens on edit attempt?
- **Locked records** — what fields are read-only? Does code respect the lock?
- **Tenant boundary** — could one tenant's data leak via this code path?

### 3. Construction-domain sense check

The logic must make sense to a Project Manager in the field, an accountant entering invoices, or an owner looking at a draw. Ask:

- **Would Diane (accounting) accept this output?** If the code computes something Diane would visually recognize as wrong, the code is wrong.
- **Would a PM understand the UI?** Field names, status values, error messages — do they match the words a PM uses?
- **Does this match the AIA G702/G703 standard?** When the change touches draw math, verify against Drummond Pay App 8.
- **Does this match Ross Built policy?** Payment schedule, deposit %, GC fee rates, draw cutoffs — match the rules in CLAUDE.md.
- **Could this be auditable?** If a client asks "where did this number come from?", can the system answer with row-level evidence?

### 4. State-machine integrity

For any status transition, check:

- **All transitions are explicitly enumerated.** No path is implicit.
- **Reverse transitions handled.** If `pm_approved → qa_kicked_back` is allowed, the recipient gets back to a sane state.
- **Locked states block writes.** `in_draw`, `submitted`, `paid` block edits via `isLocked()` helpers.
- **Status history written on every transition.** No silent transitions.
- **Computed fields updated atomically.** When status changes, dependent caches update in the same transaction (or via trigger).
- **Permission gates respect role.** PM can't QA-approve; QA can't override PM-approved cost codes.

## Drummond fixture harness

When the change is non-trivial, run the reasoning against Drummond:

- Open `__tests__/fixtures/classifier/.local/` (Drummond reference invoices) and `Drummond Pay App 8` (reference draw).
- Walk the change through the Drummond scenario step by step.
- Note any place where Drummond's actual numbers would be computed differently by the new code.

## Output shape

Produce a structured analysis:

```
INPUT: <concrete realistic example>
FORWARD REASONING: <step-by-step expected behavior>
ACTUAL BEHAVIOR: <what the code does>
DELTA: <where they differ — or "matches">

EDGE CASES:
  - [BLOCKING] <case>: <what breaks>
  - [WARNING]  <case>: <what's risky>
  - [NOTE]     <case>: <what's worth documenting>

DOMAIN SENSE CHECK:
  - <plausible/implausible to a PM/Diane/owner — and why>

STATE MACHINE:
  - <transitions covered/missing>

VERDICT: <PASS | NEEDS WORK | BLOCKING>
RECOMMENDED FIXES: <prioritized list>
```

## Hard rules

- **Never trust that a passing test means the logic is right.** Tests check what was thought of; this skill checks what wasn't.
- **Always reason in cents.** Don't let dollars sneak into the analysis — that's where rounding bugs hide.
- **Always trace the audit log.** If a change happens but no audit row is written, the change is wrong.
- **Always check the lock state.** A change to a locked record's fields is a bug, even if the code "succeeds."
- **Always ask: would I tell Jake this output is correct?** If you'd hesitate, escalate.

## Cross-references

- `nightwork-ai-logic-tester` agent — invokes this skill in fresh context during `/nightwork-qa`.
- `nightwork-spec-checker` agent — pairs with this skill (spec-checker checks "did we build what was asked"; this skill checks "does what we built actually work right").
- `postgres-patterns` skill — for DB-level reasoning about indexes, RLS, and query plans.
- `nightwork-data-portability` skill — when import/export logic is in scope.
