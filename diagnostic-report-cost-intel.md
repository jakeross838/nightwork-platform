# Cost Intelligence Diagnostic Report

**Target:** Ross Built org on dev (`egxkffodxcefwpqmwrur`)
**Date:** 2026-04-21
**Mode:** Read-only investigation, no code or data modified.

---

## Raw query results

### Q1 — Item count
| item_count |
|---|
| **1** |

Only ONE row in `items` for Ross Built. The user's expectation of "~109 from the backfill" is **wrong** — the 109 is the number of *extraction lines* pending verification, not items. No items have been created because ai_new_item lines are designed to require human approval before entering the spine.

### Q2 — Duplicate detection
Zero pairs returned (similarity > 0.7). Trivially true because only one item exists.

### Q3 — Vendor spread per item
| canonical_name | vendor_count | pricing_observations |
|---|---|---|
| Vetro Stone-Seabrook 3CM countertop | 1 | 1 |

One item, one vendor, one observation. No cross-vendor aggregation has happened yet — but that's because nothing has been verified, not because matching is broken.

### Q4 — Match tier distribution
| match_tier | count | avg_confidence | min | max |
|---|---|---|---|---|
| ai_new_item | **109** | 0.043 | 0.000 | 0.650 |
| alias_match | 1 | 1.000 | 1.000 | 1.000 |

**109 of 110 lines routed to `ai_new_item`**. The AI returned near-zero confidence on almost every proposal. The one alias_match is the Vetro Stone row — that single item was verified previously, its alias fired on re-backfill.

### Q5 — Alias count
| alias_count |
|---|
| **1** |

One alias. Directly corresponds to the one verified item. The alias library is empty because no other lines have been verified yet.

### Q6 — Junk line samples
Representative pending lines (all `ai_new_item`, all 0.000 confidence except one at 0.100):

- `PORTABLE RESTROOM 2X WEEK SERVICE` → proposed_type=service
- `HAND SANITIZER` → proposed_type=material
- `Stucco work progress payment - Amount of this Draw` → proposed_type=subcontract
- `3rd Draw for paint and prime stucco` → proposed_type=labor
- `8x20 Combo-Rent 03/03/2026 to 04/01/2026 - Site Location: 715 North Shore Drive...` → proposed_type=equipment
- `Electric service charges for billing period Feb 11 - Mar 12, 2026` → proposed_type=service
- `Change Order #4 - Replaced damaged ductwork...` → proposed_type=service
- `715 north shore drive - fishing project - Interior trim - partial payment of last draw, 50% ($8,942.94)...` → proposed_type=labor, confidence 0.100

Pattern: the AI is trying to classify transactional line items (progress draws, rent, recurring services, change-order narratives, partial payments) as if they were discrete catalog items. They're not — they're billing events that happen to land as line items on invoices.

### Q7 — Unique junk descriptions
| unique_junk_descriptions |
|---|
| **14** |

Fourteen distinct descriptions match the junk pattern. Small absolute number, but the lines are emotionally loud in the UI because they all render as "NEW ITEM · 0% confidence" and dominate the verification queue by volume (multiple line copies of each).

---

## Investigation narrative

### 1. Is the system creating duplicates?
**No.** There is exactly one item in the database. Duplicate detection (Q2) returned zero pairs. The hypothesis in the prompt ("200+ items = duplicates being created") is not the situation we're in — we have the opposite problem (nothing is being committed).

### 2. Is matching working at all?
**Yes, and the routing is correct.** The 109 `ai_new_item` results are expected given the state of the database:
- Tier 1 (alias_match) requires a previously-seen alias — we have 1 alias total, so only 1 line benefits.
- Tier 2 (trigram against past aliases) requires a pool of past aliases — same problem.
- Tier 3 (AI semantic match against existing items) requires existing items to match against — we have 1 item, so candidates are essentially empty on every call.
- Tier 4 (ai_new_item) is what fires when there's nothing to match to.

So the pipeline is working; it just has nothing to match against because nothing has been verified. **The system is cold-started.** Alias library and item catalog build up only as humans approve lines.

### 3. Why is the UI showing 0% confidence everywhere?
**Partial bug — the number is technically accurate but semantically meaningless for this tier.**

Looking at `src/lib/cost-intelligence/match-item.ts` (the AI prompt):
> "If match='existing', set matched_item_id to the candidate's id..."
> "If match='new', leave matched_item_id null and fully populate proposed_item."
> "Confidence below 0.75 → treat as ambiguous, prefer 'new'."

The `confidence` field is overloaded. For a match it means "how confident that candidate ID is the right one". For a new-item proposal, the prompt doesn't explicitly say what confidence measures. Claude is interpreting this as "confidence of a match" (which by definition is 0 when there's no match) rather than "confidence in the classification". Result: proposals that are probably reasonable classifications ("this is a portable restroom service") get stamped 0.000 and render as scary "0% AI" badges in the UI.

The UI isn't lying, but the number it's showing doesn't mean what the user thinks it means.

### 4. How many junk non-item lines are present?
**14 distinct descriptions**, but they appear as multiple repeated lines across invoices. Categories:
- Progress payments / draws (~4 distinct)
- Rent / equipment rental narratives (~3)
- Recurring services (portable restroom, hand sanitizer, electric service billing period)
- Change order narratives (long descriptive text, partial payments)

These don't belong in the item catalog at all — they're billing events or cross-period service charges. The current taxonomy (`material | labor | equipment | service | subcontract | other`) has nowhere clean to put them, so the AI guesses `service` or `subcontract` and looks dumb doing it.

### 5. Biggest problem to fix first
**The "confidence" signal is miscalibrated, not the pipeline.** The verification queue UI is amplifying a semantic ambiguity in the AI prompt into a scary-looking "0% confidence everywhere" display. Fixing the prompt (and/or the UI label) will recover the actual useful signal.

A close second: there's no way to mark a line as **not an item** — it's a transaction. Every progress-payment line is currently forced to pick a wrong `item_type`. A "skip / not an item" verification action would clean up the queue fast.

### 6. Recommended fix (next prompt)

1. **Split the confidence semantics in the AI prompt.** Two separate fields: `match_confidence` (0 when new) and `classification_confidence` (how sure of the proposed type/category/spec for a new item). UI uses `classification_confidence` for ai_new_item badges.

2. **Add a `skip` / `non_item` verification action.** User can mark a pending line as "this is not a catalog item" (progress payment, rent period, partial draw, service-charge billing) → line marked rejected with reason=non_item, not committed to spine, but tagged so the pattern can feed back as negative training signal.

3. **Seed the alias library with a one-time bulk "trust the AI" pass**, scoped to `ai_new_item` lines that parse cleanly (have a real description, non-trivial amount, item_type=material/equipment/labor). Run it as admin-only with dry-run + confirm. Bootstraps the catalog so Tier 1/2 can start firing on subsequent invoices.

4. **Re-label the confidence badge on the verification queue** for `ai_new_item` tier specifically. Instead of "0% AI" show "NEW ITEM — <proposed_type>" with a neutral color. Only show a confidence percent when tier is `ai_semantic_match` (where the percent genuinely ranks candidates).

5. **Regex pre-filter** at extraction time: if raw_description matches `progress.*payment`, `\d+(?:st|nd|rd|th)\s+draw`, `(rent|service)\s+\d{2}/\d{2}`, auto-stage as `is_transaction_line=true` (new column on extraction_lines) and skip `matchItem`. Keeps the 14 noise descriptions out of the verification queue entirely.

---

## Summary

- **No duplicate bug.** Only 1 item in db; zero similar pairs.
- **No matching bug.** Pipeline is cold — nothing to match to, so Tier 4 fires. This is correct behavior.
- **UI is misleading but not broken.** 0% confidence on ai_new_item lines is Claude interpreting "confidence" as "match confidence" (which is 0 by definition for new items), not "classification confidence".
- **14 junk descriptions** are clogging the queue — transactional lines (rent, progress payments, services) don't fit the item taxonomy.
- **Nothing in the data warrants a migration or rollback.** The next move is a prompt refinement + a "not an item" verification action + a catalog bootstrap.

## Next build prompt recommendation

A targeted sprint: **(a)** split confidence semantics in the AI matching prompt, **(b)** add `verification_status = 'not_item'` action + reason on extraction lines, **(c)** add a pre-extraction regex filter for transaction-line patterns, **(d)** change the verification-queue confidence badge so `ai_new_item` renders as a neutral "NEW · {type}" pill instead of "0% AI". Purely UI + small schema addition + prompt change. No destructive migrations, no backfill needed.
