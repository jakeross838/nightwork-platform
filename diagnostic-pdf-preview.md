# Diagnostic — Invoice PDF not rendering in verification detail panel

## 1. Does `InvoicePdfPreview` exist?

**Yes.** `src/components/cost-intelligence/invoice-pdf-preview.tsx` exists and compiles. It renders a collapsible "View invoice PDF" toggle and an `<iframe src={fileUrl}>` when opened.

Relevant lines:

- `invoice-pdf-preview.tsx:12` — returns `null` if `fileUrl` is falsy, else renders.
- `invoice-pdf-preview.tsx:28-32` — `<iframe src={fileUrl}>`. No signed-URL resolution.

## 2. Is it imported/used in the detail panel?

**Yes.**

- `verification-detail-panel.tsx:8` — `import InvoicePdfPreview from "./invoice-pdf-preview"`.
- `verification-detail-panel.tsx:393-395` — rendered inside the scrollable body:
  ```tsx
  <InvoicePdfPreview
    fileUrl={invoice?.original_file_url}
    invoiceId={invoice?.id}
  />
  ```

Chrome confirms the collapsible toggle ("View invoice PDF") renders. Clicking it expands an iframe.

## 3. Do invoices have PDF URLs in the database?

Schema-wise, yes. All 56 Ross Built invoices have `original_file_url` populated. But the column stores a **storage object path**, not an absolute URL:

| Column               | Type | Example                                                                 |
|----------------------|------|-------------------------------------------------------------------------|
| `original_file_url`  | text | `00000000-0000-0000-0000-000000000001/uploads/1776533081578_31_Home_Depot_Posts.pdf` |
| `original_file_type` | text | `pdf`                                                                   |
| `original_filename`  | text | `31_Home_Depot_Posts.pdf`                                               |

DB stats:
- total = 56, with_url = 56, absolute_urls = **0**, relative paths = **56**.

## 4. Are files present in Supabase storage?

**Yes.** Bucket `invoice-files` exists (`public = false` — private). The sample file `00000000-.../uploads/1776533081578_31_Home_Depot_Posts.pdf` is confirmed present in `storage.objects`.

Other buckets for reference: `lien-release-files` (public), `logos` (public). Only `invoice-files` is private.

## 5. Does any API return a signed PDF URL?

Only one place in the codebase calls `createSignedUrl`:

- `src/app/api/invoices/[id]/route.ts:63` —
  ```ts
  supabase.storage.from("invoice-files").createSignedUrl(invoice.original_file_url, 3600)
  ```

The verification page reads `invoice_extraction_lines` directly from the Supabase JS client (`src/app/cost-intelligence/verification/page.tsx:101`, `:199`) and propagates `inv.original_file_url` verbatim into `QueueLine.invoice.original_file_url`. It **never** calls `createSignedUrl`, and there is no API route that returns a signed URL for verification.

## 6. Chrome MCP observation

After clicking a Materials-tab line and expanding "View invoice PDF":

```json
{
  "iframe_count": 1,
  "src": "http://localhost:3000/cost-intelligence/00000000-0000-0000-0000-000000000001/uploads/1776533081578_31_Home_Depot_Posts.pdf",
  "title": "Invoice PDF",
  "width": 872, "height": 400
}
```

The iframe's `src` resolved the raw storage path as a **relative URL** against the current page (`/cost-intelligence/verification`), so the browser requests `http://localhost:3000/cost-intelligence/<storage-path>` — a nonexistent Next.js route. The iframe either renders the 404 page or stays blank, so the user sees no PDF.

## 7. Root cause

**No signed-URL generation.** The pipeline is:

1. DB stores `original_file_url` as a Supabase Storage object path (correct).
2. Verification page copies that path verbatim into the queue data.
3. `InvoicePdfPreview` passes it straight to `<iframe src>` — which resolves it as a relative URL against `localhost:3000`.
4. The bucket is private, so even if the full `https://<project>.supabase.co/storage/v1/...` URL were constructed, it would 403 without auth.

The canonical pattern (`/api/invoices/[id]`) signs the path with `createSignedUrl(path, 3600)` before returning it to the client. The verification page skips that step.

## 8. Recommended fix (3–5 bullets)

- **Add a signed-URL resolver to the verification data path.** Options, smallest → largest blast radius:
  - Call `supabase.storage.from("invoice-files").createSignedUrl(original_file_url, 3600)` inside `fetchData()` in `src/app/cost-intelligence/verification/page.tsx` once per unique invoice, store the signed URL on `QueueLine.invoice.signed_pdf_url`, and pass that (instead of `original_file_url`) to `InvoicePdfPreview`. Preferred.
  - Or: add `GET /api/cost-intelligence/extractions/[extractionId]/pdf-url` and have `InvoicePdfPreview` fetch the signed URL on first expand. More network, but avoids signing URLs the user never views.
- **Fallback-handle legacy rows with absolute URLs.** `InvoicePdfPreview` already tests the `.pdf` extension; if `original_file_url` starts with `http`, use it as-is (no signing). Cheap defensive check.
- **Fix the link "Open full invoice"** target — currently `/invoices/${invoiceId}`, which is correct; confirm that page renders the signed URL successfully (it does, via `/api/invoices/[id]`).
- **Cache signed URLs in component state** keyed by invoice id, so switching between lines on the same invoice doesn't re-sign.
- **No schema change needed.** The stored path is the right thing to store; only the render path needs to sign on read.

## Investigation scope

No code changes were made. All findings are from reading existing files, querying dev Supabase, and Chrome DOM inspection.
