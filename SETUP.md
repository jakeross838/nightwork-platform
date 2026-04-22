# Nightwork — Setup Guide

Get this project running on a new machine in ~5 minutes.

## Prerequisites

- **Node.js 18+** (check with `node -v`)
- **Git** (check with `git -v`)
- **Claude Code CLI** (install from https://claude.ai/code)

## 1. Clone and Install

```bash
git clone https://github.com/jakeross838/nightwork-platform.git
cd nightwork-platform
npm install
```

## 2. Environment Variables

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://egxkffodxcefwpqmwrur.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVneGtmZm9keGNlZndwcW13cnVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDEyMDAsImV4cCI6MjA5MTY3NzIwMH0.XneB8jpkdiIN04vYGqzwHCUA-3znuICcu-1pp_qlB3Q
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY_HERE
```

Replace `YOUR_KEY_HERE` with your actual Anthropic API key.

## 3. Connect Supabase MCP (for Claude Code)

```bash
claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=egxkffodxcefwpqmwrur"
```

Then authenticate in a separate terminal:

```bash
claude /mcp
```

Select `supabase` → Authenticate → Complete the browser flow.

## 4. Install Agent Skills (optional)

```bash
npx skills add supabase/agent-skills --yes
```

## 5. Run the Dev Server

```bash
npm run dev
```

Open http://localhost:3000

## What's Already Set Up

The Supabase database (project `egxkffodxcefwpqmwrur`) already has:
- **9 tables**: jobs, vendors, cost_codes, budget_lines, purchase_orders, change_orders, invoices, draws, draw_line_items
- **217 cost codes** seeded across 29 categories (75 change order variants)
- **1 test job**: Drummond — 501 74th St, Holmes Beach, FL 34217
- **Storage bucket**: `invoice-files` (private)
- **RLS policies**: Permissive for development (will tighten with auth)

## What You Can Do

1. **Upload Invoices** → `/invoices/upload` — Drag and drop PDFs, images, or DOCX files. Claude AI parses them.
2. **Save & Route** → Saves parsed invoice to DB with auto job/cost code matching.
3. **Invoice Queue** → `/invoices/queue` — PM review queue sorted by age.
4. **Review Invoice** → `/invoices/[id]` — 3-column layout: doc preview, editable form, budget sidebar. Approve/Hold/Deny.

## Resuming Work with Claude Code

Start Claude Code in the project directory:

```bash
cd nightwork-platform
claude
```

Claude will read `CLAUDE.md` for full project context. Key things to tell it:
- "Read CLAUDE.md" to get full context on architecture, data model, and workflow
- The Supabase MCP tools let Claude run SQL, apply migrations, and manage storage directly
- All business logic is in server-side API routes (`/app/api/`)
- Frontend is display + forms only (`/app/invoices/`)

## Current State (as of last session)

- **Phase 0**: Complete — scaffold, schema, auth (pending), storage
- **Phase 1**: In progress — invoice upload + AI parsing + PM queue + review page working
- **Next up**: QA review queue, QuickBooks push, draw generation
