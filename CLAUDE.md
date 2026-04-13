# Ross Command Center

Invoice processing and draw generation platform for Ross Built Custom Homes, a luxury coastal custom home builder in Bradenton/Anna Maria Island, FL. 14 simultaneous projects, $1.5M-$10M+ range, cost-plus open book.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (database + auth)
- Claude API (Anthropic SDK)

## Phase 1

- Invoice upload (drag-and-drop)
- AI extraction with confidence scoring
- PM approval workflow
- Draw generation (AIA G702/G703 format)

## Architecture Rules

- **Every record**: `id` (UUID), `created_at`, `updated_at`, `created_by`, `org_id`
- **Soft delete**: `deleted_at` timestamp, never actual deletion
- **Status history**: JSONB column logging every status change (`who`, `when`, `old`/`new`, `note`)
- **Amounts**: Stored in cents (integer). Format in frontend.
- **`job_id`**: Universal parent for all financial records

## Invoice Parse Schema

- `vendor_name`, `vendor_address`, `invoice_number`, `invoice_date`
- `po_reference`, `job_reference`, `description`
- `line_items` (JSON array)
- `total_amount` (cents)
- `invoice_type`: `progress` | `time_and_materials` | `lump_sum`
- `co_reference`
- `confidence_score`

## Payment Schedule

Computed, not parsed:
- Received by 5th → paid 15th
- Received by 20th → paid 30th
- Weekend/holiday → next business day

## Roles

- **PM** — Project Manager
- **Accounting** — Finance/bookkeeping
- **Admin** — Full access
