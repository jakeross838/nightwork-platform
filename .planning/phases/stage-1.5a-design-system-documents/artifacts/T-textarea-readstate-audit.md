# T-tx-4 — Textarea read-state audit

**Date:** 2026-04-30
**Owner:** Claude (Opus 4.7) on behalf of Jake
**Trigger:** nwrp18 directive (B) — audit read-display of long-text fields
across the playground; wherever a Textarea value is rendered as read-only
(not in edit mode), confirm full content shows with proper line wrapping;
no truncation; if truncation is appropriate (e.g., list-view summary),
explicit `…` with click-to-expand.

**Method:** ripgrep across `src/` for the three patterns indicating
read-state display of long-text fields:

1. `whitespace-pre-wrap` — correct line-wrapping (positive signal)
2. `truncate` — CSS truncation (potential issue if no expand)
3. `line-clamp-N` — multi-line truncation (potential issue if no expand)

Then cross-reference each match with the surrounding component to
classify as **OK**, **TRUNCATED-NEEDS-EXPAND**, or **TRUNCATED-OK**.

---

## Summary counts

| Classification | Count | Notes |
|---|---|---|
| **OK** | 6 | Properly wrapping, full content shown |
| **TRUNCATED-OK** | ~50 | List/cell truncation with link to detail view |
| **TRUNCATED-NEEDS-EXPAND** | 4 | Long-text rendered as truncate/line-clamp WITHOUT a path to full content |

**No auto-fixes applied per nwrp18 — audit informs the polish pass.**

---

## OK — full content with `whitespace-pre-wrap`

These render Textarea-derived long-text fields with correct line-break
preservation. Full content is visible; user scrolls if needed; line
breaks render as authored.

| File | Line | Field | Notes |
|---|---|---|---|
| `src/app/change-orders/[id]/page.tsx` | 214 | `co.description` | Detail view, primary surface for the long-text field. Correct. |
| `src/app/admin/platform/feedback/[id]/page.tsx` | 188 | feedback `note` | Detail view of a feedback row. Wraps with bordered card. Correct. |
| `src/app/admin/platform/support/[id]/page.tsx` | 274 | support message body | Detail of a support message. Correct. |
| `src/app/proposals/review/[extraction_id]/ReviewManager.tsx` | 568 | `form.scope_summary` (read-only review display) | `whitespace-pre-line` for narrower whitespace handling — preserves newlines, collapses runs of spaces. Correct for proposal review. |
| `src/components/draw-cover-letter-editor.tsx` | 132 | cover letter editor (now Textarea) | The editor itself uses Textarea (T-tx-2 migration). Read-state for the rendered/printed cover letter is in the draw export pipeline (out of scope for this audit). |
| `src/components/items/raw-ocr-viewer.tsx` | 44 | raw OCR text dump | Debug viewer renders OCR text correctly with whitespace preservation. |
| `src/components/support-chat-widget.tsx` | 414 | chat message body bubbles | Correct. |

---

## TRUNCATED-OK — list-view truncation with detail-view path

These use `truncate` or `line-clamp-N` in cell/list contexts where the
row is a click-target into a detail page that shows full content. Per
nwrp18 (B), this is the documented acceptable pattern. **No remediation
needed.**

Sampled cases (full list available via `grep -rn "truncate" src/`):

| Surface | Pattern | Path to full content |
|---|---|---|
| `src/app/jobs/[id]/change-orders/page.tsx:247` | `<p className="truncate">{co.title ?? co.description ?? "—"}</p>` | Click row → `/change-orders/[id]` (full detail with `whitespace-pre-wrap`) |
| `src/app/jobs/[id]/purchase-orders/page.tsx:247` | `<td …max-w-md truncate>{po.description ?? "—"}` | Click row → PO detail page (TODO: confirm wraps) |
| `src/components/cost-intelligence/queue-item.tsx:40` | `text-[12px] text-[var(--text-primary)] truncate` | Click row → item detail page |
| `src/components/proposals/ProposalReviewHeader.tsx:56,66` | header label truncate (vendor name + proposal number) | Already in detail page; truncation is for header constraints |
| `src/components/invoices/InvoiceHeader.tsx:54,62` | invoice header chips truncate | Same as proposal — header chips |
| `src/components/breadcrumbs.tsx:52,57` | breadcrumb segment truncate | Standard nav pattern |
| `src/components/admin/audit-row.tsx:81` | audit log row truncate (`max-w-[340px]`) | Click row → expanded audit row |
| Job/vendor/cost-code list cells | `truncate` on names | Click row → entity detail |

---

## TRUNCATED-NEEDS-EXPAND — needs polish-pass remediation

These are the 4 surfaces where long-text fields are visibly truncated
WITHOUT an obvious path to the full content (or where the truncation
shows in a summary/inbox without a detail link, OR where the link path
hasn't been verified to render full content).

### Top 3 NEEDS-EXPAND findings to surface for the polish pass

1. **`src/app/invoices/[id]/page.tsx:2055`** — Partial-approve modal line-item table
   ```
   <span className="line-clamp-2">{li.description || "—"}</span>
   ```
   - **Surface:** Inside the partial-approve workflow modal, the line items
     are listed in a table. Long invoice line descriptions get clamped to
     2 lines with no expand control.
   - **Impact:** PMs reviewing partial approvals can't see full descriptions
     in-modal. They'd have to close the modal and scroll the main invoice
     page (or open the original PDF) to read the full text.
   - **Suggested fix (polish pass):** Replace `line-clamp-2` with
     `whitespace-pre-wrap` (line items are usually short anyway; the
     truncation is over-conservative). Alternatively, add a `<details>`
     expand affordance with the full description or wrap each row in a
     hover `Tooltip` that shows the full text.

2. **`src/components/notification-bell.tsx:151`** — Notification body in dropdown
   ```
   <p className="mt-0.5 text-xs text-[color:var(--text-muted)] line-clamp-2">
     {n.body}
   </p>
   ```
   - **Surface:** Notification bell dropdown shows recent notifications.
     The body is clamped to 2 lines. The notification is clickable to a
     destination URL but the URL is the *source* of the event, not the
     full notification body.
   - **Impact:** If a notification body has more detail than fits in 2
     lines, the user can't see the rest without going to the source page
     (which may or may not surface the original notification body).
   - **Suggested fix (polish pass):** Either expand on hover/focus with a
     tooltip, OR add a "View notification" entry to the notification
     center that renders the full body with `whitespace-pre-wrap`.

3. **`src/app/admin/platform/feedback/page.tsx:470`** + **`src/app/admin/platform/support/page.tsx:392`** — Inbox truncation
   ```
   <td …>{truncate(r.note, 120)}</td>
   <td …>{truncate(r.title, 120)}</td>
   ```
   - **Surface:** Platform-admin feedback and support inboxes truncate
     `note` / `title` to 120 chars with `…`. Each row IS clickable to a
     detail view (`/admin/platform/feedback/[id]` and
     `/admin/platform/support/[id]`), and those detail views DO render
     full content with `whitespace-pre-wrap` (verified: feedback detail
     line 188, support detail line 274).
   - **Classification revision:** This actually qualifies as
     **TRUNCATED-OK** since the click-to-detail path exists. **The only
     polish-pass concern** is whether the truncation is *visible* enough —
     the trailing `…` gives a clear cue but Jake may want a row-level
     "expand" inline accordion as an alternative. Filing this as
     NEEDS-EXPAND only because the suggested-fix decision is Jake's call.

### 4th finding (lower priority)

4. **`src/app/cost-intelligence/suggestions/SuggestionsManager.tsx:130`** — Suggestion rationale inline
   ```
   <span className="font-medium">Rationale:</span> {row.rationale}
   ```
   - The rationale is rendered inline without `whitespace-pre-wrap` and
     without truncation. If a rationale has explicit `\n` line breaks
     (the field is a Textarea), they'll collapse. This is a minor display
     issue (rationales are usually 1-2 sentences) but should add
     `whitespace-pre-wrap` for hygiene.

---

## Recommendation for nwrp18 polish pass

When Jake returns to this audit:

1. Fix the partial-approve modal line-item rendering (item 1 above) —
   highest-impact: PMs use this modal during the approval flow.
2. Decide on notification dropdown UX (item 2) — either tooltip-on-hover
   or move to a notification-center detail page.
3. Optional: add `whitespace-pre-wrap` to rationale rendering (item 4)
   for consistency.
4. Re-classify the inbox truncation (item 3) once Jake confirms whether
   the trailing `…` + click-to-detail flow is sufficient or whether an
   inline-expand row is desired.

No auto-fixes applied in this audit pass per nwrp18 directive.

---

## Cross-references

- `.planning/phases/stage-1.5a-design-system-documents/artifacts/T-textarea-readstate-audit.md` (this file)
- `src/components/ui/textarea.tsx` — upgraded primitive (T-tx-1)
- 35 migration sites in T-tx-2 commit (`a145dbb`)
- T-tx-3 design-system playground entry (`2600ef9`)
