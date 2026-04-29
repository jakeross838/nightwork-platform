> SUPERSEDED 2026-04-29 by docs/nightwork-plan-canonical-v1.md. Kept for history.

# Diagnostic — source-line highlighting on the invoice PDF

## 1. What data exists today

Schema columns matching OCR / position / span / region / offset / bbox / page / coord across `invoice_extractions` and `invoice_extraction_lines`:

| table                      | column          | notes                          |
|----------------------------|-----------------|--------------------------------|
| `invoice_extractions`      | `raw_ocr_text`  | TEXT, nullable                 |

That's the only column. **NULL on every sampled row** (3 recent extractions: `Volcano Stone`, `Metro Electric`, `Triple H Painting`). No bounding-box / page / span / offset fields exist on either table, and none on `invoice_line_items` either — which has `line_index`, `description`, `qty`, `unit`, `rate`, `amount_cents`, no position fields.

The only thing approximating "source location" is ordinal: `invoice_line_items.line_index` and `invoice_extraction_lines.line_order`. Both are 0-based counters in document reading order. Neither is enough to place a rectangle on a page.

## 2. How PDFs are actually processed

`src/lib/claude/parse-invoice.ts:155-178` sends the PDF straight to Claude as a `document` content block:

```ts
contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 }});
```

No separate OCR step. The response schema (line 86–135) asks only for text fields: `vendor_name`, `invoice_number`, `line_items[].description`, etc. No `page`, no `bbox`, no `match_text`. So every bit of positional ground truth the AI might "know" is thrown away at parse time.

`extraction_model` is `claude-sonnet-4-20250514` across all rows. Anthropic does expose PDF citations as an experimental/beta capability on some models, but the current prompt does not enable or request them.

## 3. How PDFs are rendered today

`src/components/cost-intelligence/invoice-pdf-preview.tsx` is 53 lines:

```tsx
<iframe src={fileUrl} title="Invoice PDF" className="w-full h-[400px]" />
```

Browser's built-in PDF viewer (Chrome's `pdfium`). No annotation layer, no programmatic access to text layer or coordinates.

**Happy surprise:** `react-pdf@^7.7.3` is already in `package.json` but not yet imported anywhere. That library ships pdfjs-dist + a React renderer that gives us full control over the text layer, page navigation, and custom overlays — we'd pay no install cost to switch to it.

## 4. Approaches

### A. Full bounding-box highlight

What you'd need:

- `invoice_extraction_lines.source_page_number INT` (1-indexed)
- `invoice_extraction_lines.source_bbox JSONB` shape `{ x, y, w, h }` in PDF points
- A capture step that produces those values

Capture options, hardest → easiest:

1. **pdfjs-dist text layer + fuzzy match.** Rasterize/parse each PDF, walk the text-layer geometry, match AI's `line_items[].description` against text runs on each page, emit the tightest bounding box that covers the match. Works for text-layer PDFs. Image-only scans need prior OCR (Tesseract/Textract) which we don't have.
2. **Claude citations API.** Ask Claude (via beta document citations) to return `cite_page` + `cite_start/cite_end` (text offsets within page). We'd still need the page's text geometry to turn offsets into rectangles — unless we're happy with page-level highlighting (see C).
3. **Textract / Document AI.** External OCR service returns word-level geometry. Highest cost + vendor lock-in. Overkill for this demo.

Render side: react-pdf `<Page>` + custom overlay `<div>` absolutely positioned over the page canvas using the bbox. Straightforward once you have the data.

**Estimate:** 1–2 days to ship option A1 for text-layer PDFs + a backfill over the 56 existing invoices. Most Ross Built invoices (Island Lumber, Home Depot) are text-layer-native; a handful are scans where we'd fall back to page-only highlighting.

### B. OCR-text highlight (no PDF, just text)

What you'd need:

- Populate `raw_ocr_text` on `invoice_extractions` (currently NULL).
- A text-mode viewer that renders the raw text and highlights the substring matching the selected line's `raw_description`.

Capture: either bump Anthropic's prompt to also return the full extracted text (costs an extra ~2–3k output tokens per invoice, trivial) OR run a separate cheap pass that just asks for verbatim OCR.

Pros: cheapest data capture, works for scans too because Claude will happily OCR them.
Cons: users don't see the original PDF layout — you're showing them a text dump, not their invoice. Probably not what Jake wants for a demo to Andrew.

### C. Minimum-data: page-level jump + description search

What exists today is enough for a passable demo if we:

1. Add `source_page_number INT` per extraction line by asking Claude for it in the existing parse prompt (one schema field). One-time re-extract.
2. Switch `InvoicePdfPreview` to react-pdf. Click a line → pdfjs scrolls to that page.
3. Within the page, use pdfjs-dist's built-in text find (via `find` API) to highlight the line's description. The built-in yellow highlight is good enough.

Zero new coordinate capture. Works today against text-layer PDFs. Scans stay as "jump to the page" without a highlight.

**Estimate:** Half a day for the new field + re-extract + react-pdf swap + wire-up.

### D. Zero-data: search hash in iframe

Pass `#search=` in the iframe URL. Chrome's built-in PDF viewer ignores this hash; Firefox's does respect it. Adobe Reader respects `#search=` but it's rarely default. **Verdict: works in ~30% of browsers, which is worse than doing nothing in a cross-browser demo.**

`#page=N` *is* widely supported by browser PDF viewers — but we don't have page numbers yet. Once C populates `source_page_number`, `#page=N` alone gets us page-jumps even without swapping to react-pdf.

## 5. Recommended approach for the demo

**Do (C).** Concretely:

- Add one field to the parse prompt: `line_items[].source_page_number` (integer, 1-indexed; null if unknown).
- Thread it through `extract-invoice.ts` into `invoice_extraction_lines.source_page_number` (requires a nullable INT column).
- Re-extract the 56 Ross Built invoices (~$1 of Anthropic spend).
- Install nothing new — react-pdf is already in deps. Replace the `<iframe>` in `invoice-pdf-preview.tsx` with react-pdf `<Document>` + `<Page pageNumber={selectedPage}>`. On line selection, update `selectedPage`.
- For within-page highlight, use react-pdf's `customTextRenderer` to wrap matched spans in a yellow `<mark>`. Match heuristic: strip common OCR noise and look for the AI-proposed `description` as a substring of the page's text-layer. If no match, just show the page without highlight.

This delivers visible page-jump + yellow text highlight for ~90% of invoice lines, with zero new infrastructure and one tiny schema addition. Scans still work (page jump), just without the highlight.

**Defer (A)** until you actually see users wanting a pixel-accurate box. For most verification use cases, "scroll to page 2 and highlight the row" is sufficient — the PM's eye does the rest.

## Investigation scope

No code changes. Findings from Supabase MCP + reading `src/lib/claude/parse-invoice.ts` and `src/components/cost-intelligence/invoice-pdf-preview.tsx` + `package.json`.
