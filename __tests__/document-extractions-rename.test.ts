/**
 * Phase 3.1 regression fence — R.15.
 *
 * Migration 00076 renames two existing tables:
 *   public.invoice_extractions      → public.document_extractions
 *   public.invoice_extraction_lines → public.document_extraction_lines
 *
 * Plus 3 new classifier routing columns on document_extractions:
 *   classified_type         TEXT  (10-val CHECK or NULL)
 *   target_entity_type      TEXT  (7-val committable-subset CHECK or NULL)
 *   target_entity_id        UUID  (bare, NO foreign key)
 *
 * Plus backfill of 56 active pre-existing rows (Amendment F):
 *   classified_type='invoice', target_entity_type='invoice',
 *   target_entity_id=invoice_id.
 *
 * Plus Amendment F completeness probe: zero active rows with
 *   classified_type='invoice' AND target_entity_id IS NULL.
 *
 * Plus Amendment G selective rename of dependent database objects:
 *   - 2/4 triggers renamed (trg_invoice_extractions_touch,
 *     trg_invoice_extraction_lines_touch); 2 trg_iel_* kept neutral
 *   - 5/12 indexes renamed (4 on parent + 1 pkey on lines);
 *     7 idx_iel_* kept neutral
 *   - 6/6 policies renamed (per user Stage 1 decision, overrides
 *     preflight recommendation to keep iel_org_* neutral)
 *   - 14/17 constraints renamed (non-pkey); 3 iel_*_check kept;
 *     2 pkeys renamed via ALTER INDEX (since Postgres indexes back
 *     primary-key constraints of the same name)
 *
 * Plan amendments landed at commit c5cbdb9. Pre-flight findings at
 * qa-reports/preflight-branch3-phase3.1.md (commit 777b752) cover the
 * 14 amendments (A-N) and 5 decisions resolved.
 *
 * AMENDMENT D — classified_type vs target_entity_type SEMANTIC
 * DISTINCTION: classified_type is the classifier's output ("what the
 * document IS"); target_entity_type is the commit destination ("where
 * the data GOES"). These fields can diverge in real flows — a document
 * classified_type='proposal' may be committed with
 * target_entity_type='purchase_order' when the PM accepts and converts.
 * The CHECK sets are intentionally different: classified_type accepts
 * 10 values (including plan/contract/other); target_entity_type only
 * accepts the 7 committable entities (excludes plan/contract/other,
 * which have no v1.0 commit target). Regression fence below asserts
 * the distinction in CHECK definitions + migration header comment.
 *
 * AMENDMENT E — target_entity_id NO FK (app-layer integrity): the
 * column is a bare UUID. Referential integrity is enforced at the
 * classifier write-path (Branch 3.2+), not at the DB layer, because
 * the referenced entity varies by target_entity_type. Matches Phase
 * 2.2 proposals.source_document_id precedent. The regression fence
 * EXPLICITLY asserts no FK constraint exists on target_entity_id —
 * this is load-bearing against a future "fix" that would break every
 * row where target_entity_type is not 'invoice'.
 *
 * This test file is static: regex assertions against the migration
 * SQL text + .down.sql. Dynamic DB probes (RLS preservation under
 * live auth, backfill completeness against real row count, 6
 * downstream FK auto-follow verification, CHECK negative paths) fire
 * during the Migration Dry-Run per R.19 and are recorded in
 * qa-reports/qa-branch3-phase3.1.md.
 *
 * Pattern matches __tests__/pricing-history.test.ts (Phase 2.8) and
 * __tests__/client-portal.test.ts (Phase 2.9).
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const MIGRATION = "supabase/migrations/00076_document_extractions_rename.sql";
const MIGRATION_DOWN =
  "supabase/migrations/00076_document_extractions_rename.down.sql";

const CLASSIFIED_TYPE_VALUES = [
  "invoice",
  "purchase_order",
  "change_order",
  "proposal",
  "vendor",
  "budget",
  "historical_draw",
  "plan",
  "contract",
  "other",
];

const TARGET_ENTITY_TYPE_VALUES = [
  "invoice",
  "purchase_order",
  "change_order",
  "proposal",
  "vendor",
  "budget",
  "historical_draw",
];

// classified_type values that must NOT appear in target_entity_type CHECK
// (the semantic distinction — Amendment D)
const CLASSIFIED_ONLY_VALUES = ["plan", "contract", "other"];

// ── migration file existence ─────────────────────────────────────────

test("migration 00076 exists", () => {
  assert.ok(existsSync(MIGRATION), `${MIGRATION} missing`);
});

test("migration 00076 has a rollback companion (.down.sql)", () => {
  assert.ok(existsSync(MIGRATION_DOWN), `${MIGRATION_DOWN} missing`);
});

// ── header documentation (all amendments cited) ──────────────────────

test("migration 00076 header cites plan-amendment commit c5cbdb9", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /c5cbdb9/i.test(src),
    "header must cite plan-amendment commit c5cbdb9"
  );
});

test("migration 00076 header cites pre-flight commit 777b752", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /777b752/i.test(src),
    "header must cite pre-flight findings commit 777b752"
  );
});

test("migration 00076 header documents Amendment D semantic distinction", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Must describe that classified_type and target_entity_type are
  // semantically distinct — one is classifier output ("what the
  // document IS"), the other is commit destination ("where it GOES").
  assert.ok(
    /classified_type[\s\S]{0,400}target_entity_type|target_entity_type[\s\S]{0,400}classified_type/i.test(
      src
    ),
    "header must discuss classified_type and target_entity_type together"
  );
  assert.ok(
    /diverge|distinct|different|subset/i.test(src),
    "header must document that classified_type and target_entity_type can diverge / are distinct"
  );
});

test("migration 00076 header documents Amendment E app-layer integrity for target_entity_id", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /app[- ]layer\s+integrity|no\s+FK|without\s+a\s+FK|bare\s+UUID/i.test(src),
    "header must document Amendment E — target_entity_id is a bare UUID with no FK; integrity enforced at app layer"
  );
  assert.ok(
    /Phase\s*2\.2|proposals\.source_document_id|source_document_id/i.test(src),
    "header must cite Phase 2.2 proposals.source_document_id precedent"
  );
  assert.ok(
    /classifier|Branch\s*3\.2/i.test(src),
    "header must reference the classifier / Branch 3.2 write-path that populates target_entity_id"
  );
});

test("migration 00076 header documents Amendment G selective rename list", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /iel_|idx_iel_|trg_iel_/i.test(src),
    "header must list the iel_* / idx_iel_* / trg_iel_* neutral-prefix decision"
  );
  assert.ok(
    /neutral|kept|preserved/i.test(src),
    "header must document the 'kept neutral' decision for the iel_* prefix family"
  );
});

test("migration 00076 header documents Amendment F backfill scope", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /backfill/i.test(src),
    "header must describe the 56-row backfill"
  );
  assert.ok(
    /completeness|probe|RAISE\s+EXCEPTION/i.test(src),
    "header must reference the backfill completeness probe"
  );
});

// ── rename operations ────────────────────────────────────────────────

test("migration 00076 renames invoice_extractions → document_extractions", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.invoice_extractions\s+RENAME\s+TO\s+document_extractions\b/i.test(
      src
    ),
    "migration must RENAME invoice_extractions TO document_extractions"
  );
});

test("migration 00076 renames invoice_extraction_lines → document_extraction_lines", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.invoice_extraction_lines\s+RENAME\s+TO\s+document_extraction_lines\b/i.test(
      src
    ),
    "migration must RENAME invoice_extraction_lines TO document_extraction_lines"
  );
});

// ── 3 new columns + CHECK constraints ────────────────────────────────

test("migration 00076 adds classified_type TEXT column (nullable)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.document_extractions[\s\S]{0,200}?ADD\s+COLUMN\s+classified_type\s+TEXT\b/i.test(
      src
    ),
    "migration must ADD COLUMN classified_type TEXT to document_extractions"
  );
  // Nullable — no NOT NULL on this column
  assert.ok(
    !/ADD\s+COLUMN\s+classified_type\s+TEXT\s+NOT\s+NULL/i.test(src),
    "classified_type must be nullable (populated by classifier in Branch 3.2+)"
  );
});

test("migration 00076 declares classified_type 10-value CHECK constraint", () => {
  const src = readFileSync(MIGRATION, "utf8");
  for (const v of CLASSIFIED_TYPE_VALUES) {
    assert.ok(
      new RegExp(`'${v}'`).test(src),
      `classified_type CHECK must include '${v}'`
    );
  }
});

test("migration 00076 adds target_entity_type TEXT column (nullable)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ADD\s+COLUMN\s+target_entity_type\s+TEXT\b/i.test(src),
    "migration must ADD COLUMN target_entity_type TEXT to document_extractions"
  );
  assert.ok(
    !/ADD\s+COLUMN\s+target_entity_type\s+TEXT\s+NOT\s+NULL/i.test(src),
    "target_entity_type must be nullable (populated on classifier/commit)"
  );
});

test("migration 00076 declares target_entity_type 7-value committable-subset CHECK", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Strip -- line comments first — the header mentions target_entity_type
  // repeatedly (for documentation) and we only want to assert against the
  // actual SQL DDL below.
  const sqlOnly = src.replace(/--[^\n]*/g, "");
  const m = sqlOnly.match(
    /ADD\s+COLUMN\s+target_entity_type\s+TEXT[\s\S]*?CHECK\s*\(([\s\S]*?)\)\s*\)\s*;/i
  );
  assert.ok(
    m,
    "could not locate target_entity_type ADD COLUMN block with CHECK"
  );
  const checkBody = m![1];
  for (const v of TARGET_ENTITY_TYPE_VALUES) {
    assert.ok(
      new RegExp(`'${v}'`).test(checkBody),
      `target_entity_type CHECK must include '${v}'`
    );
  }
  // Must NOT include plan / contract / other — Amendment D semantic
  // distinction. These 3 classified_type values have no v1.0 commit
  // target and therefore cannot appear in target_entity_type.
  for (const v of CLASSIFIED_ONLY_VALUES) {
    assert.ok(
      !new RegExp(`'${v}'`).test(checkBody),
      `target_entity_type CHECK must NOT include '${v}' (Amendment D — not committable in v1.0)`
    );
  }
});

test("migration 00076 adds target_entity_id UUID column (nullable, NO FK)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ADD\s+COLUMN\s+target_entity_id\s+UUID\b/i.test(src),
    "migration must ADD COLUMN target_entity_id UUID to document_extractions"
  );
  // Nullable
  assert.ok(
    !/ADD\s+COLUMN\s+target_entity_id\s+UUID\s+NOT\s+NULL/i.test(src),
    "target_entity_id must be nullable (populated on classifier/commit)"
  );
  // Strip -- line comments before checking for REFERENCES — the header
  // talks ABOUT the absence of REFERENCES, which we want documented, but
  // the SQL itself must not have one.
  const sqlOnly = src.replace(/--[^\n]*/g, "");
  assert.ok(
    !/ADD\s+COLUMN\s+target_entity_id\s+UUID[\s\S]{0,200}?REFERENCES/i.test(
      sqlOnly
    ),
    "target_entity_id must NOT declare REFERENCES (Amendment E — no FK; app-layer integrity)"
  );
  // Also: no separate ADD CONSTRAINT ... FOREIGN KEY on target_entity_id
  assert.ok(
    !/ADD\s+CONSTRAINT\s+\S+\s+FOREIGN\s+KEY\s*\(\s*target_entity_id/i.test(
      sqlOnly
    ),
    "target_entity_id must NOT have a separate ADD CONSTRAINT FOREIGN KEY (Amendment E)"
  );
});

test("migration 00076 registers COMMENT ON COLUMN for target_entity_id with app-layer rationale", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const m = src.match(
    /COMMENT\s+ON\s+COLUMN\s+public\.document_extractions\.target_entity_id\s+IS\s+([\s\S]*?);/i
  );
  assert.ok(
    m,
    "migration must declare COMMENT ON COLUMN public.document_extractions.target_entity_id"
  );
  const body = m![0];
  assert.ok(
    /app[- ]layer|classifier|Branch\s*3\.2|no\s+FK|without\s+a\s+FK/i.test(
      body
    ),
    "COMMENT must document app-layer integrity / classifier write-path / no-FK rationale"
  );
  assert.ok(
    /proposals\.source_document_id|Phase\s*2\.2|source_document_id/i.test(body),
    "COMMENT should cite Phase 2.2 proposals.source_document_id precedent"
  );
});

test("migration 00076 registers COMMENT ON COLUMN for classified_type with distinction rationale", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const m = src.match(
    /COMMENT\s+ON\s+COLUMN\s+public\.document_extractions\.classified_type\s+IS\s+([\s\S]*?);/i
  );
  assert.ok(
    m,
    "migration should declare COMMENT ON COLUMN public.document_extractions.classified_type"
  );
});

test("migration 00076 registers COMMENT ON COLUMN for target_entity_type with distinction rationale", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const m = src.match(
    /COMMENT\s+ON\s+COLUMN\s+public\.document_extractions\.target_entity_type\s+IS\s+([\s\S]*?);/i
  );
  assert.ok(
    m,
    "migration should declare COMMENT ON COLUMN public.document_extractions.target_entity_type"
  );
});

// ── backfill (Amendment F) ───────────────────────────────────────────

test("migration 00076 backfills 56 active rows with invoice/invoice/invoice_id (Amendment F)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /UPDATE\s+public\.document_extractions[\s\S]*?SET[\s\S]*?classified_type\s*=\s*'invoice'[\s\S]*?target_entity_type\s*=\s*'invoice'[\s\S]*?target_entity_id\s*=\s*invoice_id[\s\S]*?WHERE[\s\S]*?deleted_at\s+IS\s+NULL/i.test(
      src
    ),
    "backfill UPDATE must set classified_type='invoice', target_entity_type='invoice', target_entity_id=invoice_id, scoped to active rows"
  );
});

test("migration 00076 runs backfill completeness probe (RAISE EXCEPTION on gap)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // A DO block that SELECTs any row with classified_type='invoice' AND
  // target_entity_id IS NULL, and raises if non-zero.
  assert.ok(
    /DO\s+\$\$[\s\S]*?classified_type\s*=\s*'invoice'[\s\S]*?target_entity_id\s+IS\s+NULL[\s\S]*?RAISE\s+EXCEPTION[\s\S]*?END\s*\$\$/i.test(
      src
    ),
    "migration must contain a DO block that RAISEs on any active row where classified_type='invoice' AND target_entity_id IS NULL"
  );
});

// ── Amendment G — selective rename of dependent objects ──────────────

test("migration 00076 renames 3 policies on document_extractions side", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const expected = [
    ["invoice_extractions_org_read", "document_extractions_org_read"],
    ["invoice_extractions_org_write", "document_extractions_org_write"],
    ["invoice_extractions_org_update", "document_extractions_org_update"],
  ];
  for (const [oldName, newName] of expected) {
    assert.ok(
      new RegExp(
        `ALTER\\s+POLICY\\s+${oldName}\\s+ON\\s+public\\.document_extractions\\s+RENAME\\s+TO\\s+${newName}\\b`,
        "i"
      ).test(src),
      `must rename policy ${oldName} → ${newName}`
    );
  }
});

test("migration 00076 renames 3 policies on document_extraction_lines side (iel_org_* → document_extraction_lines_org_* — 6/6 policies per Stage 1)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const expected = [
    ["iel_org_read", "document_extraction_lines_org_read"],
    ["iel_org_write", "document_extraction_lines_org_write"],
    ["iel_org_update", "document_extraction_lines_org_update"],
  ];
  for (const [oldName, newName] of expected) {
    assert.ok(
      new RegExp(
        `ALTER\\s+POLICY\\s+${oldName}\\s+ON\\s+public\\.document_extraction_lines\\s+RENAME\\s+TO\\s+${newName}\\b`,
        "i"
      ).test(src),
      `must rename policy ${oldName} → ${newName} (Stage 1: 6/6 policies renamed)`
    );
  }
});

test("migration 00076 renames 2/4 triggers (trg_iel_* kept neutral)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // 2 renamed
  assert.ok(
    /ALTER\s+TRIGGER\s+trg_invoice_extractions_touch\s+ON\s+public\.document_extractions\s+RENAME\s+TO\s+trg_document_extractions_touch\b/i.test(
      src
    ),
    "must rename trigger trg_invoice_extractions_touch → trg_document_extractions_touch"
  );
  assert.ok(
    /ALTER\s+TRIGGER\s+trg_invoice_extraction_lines_touch\s+ON\s+public\.document_extraction_lines\s+RENAME\s+TO\s+trg_document_extraction_lines_touch\b/i.test(
      src
    ),
    "must rename trigger trg_invoice_extraction_lines_touch → trg_document_extraction_lines_touch"
  );
  // 2 kept neutral — must NOT appear in any ALTER TRIGGER ... RENAME
  assert.ok(
    !/ALTER\s+TRIGGER\s+trg_iel_landed_total\s+/i.test(src),
    "must NOT rename trg_iel_landed_total (neutral prefix — Amendment G)"
  );
  assert.ok(
    !/ALTER\s+TRIGGER\s+trg_iel_status_rollup\s+/i.test(src),
    "must NOT rename trg_iel_status_rollup (neutral prefix — Amendment G)"
  );
});

test("migration 00076 renames 5 non-idx_iel_ indexes (idx_iel_* kept neutral)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const renamed = [
    ["invoice_extractions_pkey", "document_extractions_pkey"],
    ["invoice_extraction_lines_pkey", "document_extraction_lines_pkey"],
    ["idx_invoice_extractions_invoice", "idx_document_extractions_invoice"],
    ["idx_invoice_extractions_pending", "idx_document_extractions_pending"],
    ["idx_invoice_extractions_status", "idx_document_extractions_status"],
  ];
  for (const [oldName, newName] of renamed) {
    assert.ok(
      new RegExp(
        `ALTER\\s+INDEX\\s+(?:public\\.)?${oldName}\\s+RENAME\\s+TO\\s+${newName}\\b`,
        "i"
      ).test(src),
      `must rename index ${oldName} → ${newName}`
    );
  }
  // 7 idx_iel_* neutral — must NOT be ALTER INDEX RENAME targets
  const keptNeutral = [
    "idx_iel_extraction",
    "idx_iel_invoice_line",
    "idx_iel_line_nature",
    "idx_iel_org",
    "idx_iel_pending",
    "idx_iel_source_page",
    "idx_iel_transaction_line",
  ];
  for (const idx of keptNeutral) {
    assert.ok(
      !new RegExp(`ALTER\\s+INDEX\\s+(?:public\\.)?${idx}\\s+RENAME`, "i").test(
        src
      ),
      `must NOT rename ${idx} (neutral idx_iel_* prefix — Amendment G)`
    );
  }
});

test("migration 00076 renames 4 non-pkey constraints on document_extractions side", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const renamed = [
    [
      "invoice_extractions_invoice_id_fkey",
      "document_extractions_invoice_id_fkey",
    ],
    ["invoice_extractions_org_id_fkey", "document_extractions_org_id_fkey"],
    [
      "invoice_extractions_verified_by_fkey",
      "document_extractions_verified_by_fkey",
    ],
    [
      "invoice_extractions_verification_status_check",
      "document_extractions_verification_status_check",
    ],
  ];
  for (const [oldName, newName] of renamed) {
    assert.ok(
      new RegExp(
        `ALTER\\s+TABLE\\s+public\\.document_extractions[\\s\\S]{0,80}?RENAME\\s+CONSTRAINT\\s+${oldName}\\s+TO\\s+${newName}\\b`,
        "i"
      ).test(src),
      `must rename constraint ${oldName} → ${newName} on document_extractions`
    );
  }
});

test("migration 00076 renames 10 non-pkey constraints on document_extraction_lines side (full invoice_extraction_lines_* set)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const renamed = [
    [
      "invoice_extraction_lines_extraction_id_fkey",
      "document_extraction_lines_extraction_id_fkey",
    ],
    [
      "invoice_extraction_lines_invoice_line_item_id_fkey",
      "document_extraction_lines_invoice_line_item_id_fkey",
    ],
    [
      "invoice_extraction_lines_match_tier_check",
      "document_extraction_lines_match_tier_check",
    ],
    [
      "invoice_extraction_lines_org_id_fkey",
      "document_extraction_lines_org_id_fkey",
    ],
    [
      "invoice_extraction_lines_proposed_item_id_fkey",
      "document_extraction_lines_proposed_item_id_fkey",
    ],
    [
      "invoice_extraction_lines_transaction_line_type_check",
      "document_extraction_lines_transaction_line_type_check",
    ],
    [
      "invoice_extraction_lines_vendor_item_pricing_id_fkey",
      "document_extraction_lines_vendor_item_pricing_id_fkey",
    ],
    [
      "invoice_extraction_lines_verification_status_check",
      "document_extraction_lines_verification_status_check",
    ],
    [
      "invoice_extraction_lines_verified_by_fkey",
      "document_extraction_lines_verified_by_fkey",
    ],
    [
      "invoice_extraction_lines_verified_item_id_fkey",
      "document_extraction_lines_verified_item_id_fkey",
    ],
  ];
  for (const [oldName, newName] of renamed) {
    assert.ok(
      new RegExp(
        `ALTER\\s+TABLE\\s+public\\.document_extraction_lines[\\s\\S]{0,120}?RENAME\\s+CONSTRAINT\\s+${oldName}\\s+TO\\s+${newName}\\b`,
        "i"
      ).test(src),
      `must rename constraint ${oldName} → ${newName} on document_extraction_lines`
    );
  }
});

test("migration 00076 does NOT rename 3 iel_*_check constraints (neutral prefix — Amendment G)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const keptNeutral = [
    "iel_line_nature_check",
    "iel_overhead_type_check",
    "iel_proposed_pricing_model_check",
  ];
  for (const c of keptNeutral) {
    assert.ok(
      !new RegExp(`RENAME\\s+CONSTRAINT\\s+${c}\\s+`, "i").test(src),
      `must NOT rename constraint ${c} (neutral iel_* prefix — Amendment G)`
    );
  }
});

// ── down.sql ─────────────────────────────────────────────────────────

test("migration 00076 down.sql exists and renames tables back", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.document_extractions\s+RENAME\s+TO\s+invoice_extractions\b/i.test(
      src
    ),
    "down.sql must rename document_extractions → invoice_extractions"
  );
  assert.ok(
    /ALTER\s+TABLE\s+public\.document_extraction_lines\s+RENAME\s+TO\s+invoice_extraction_lines\b/i.test(
      src
    ),
    "down.sql must rename document_extraction_lines → invoice_extraction_lines"
  );
});

test("migration 00076 down.sql drops the 3 new columns", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  for (const col of ["target_entity_id", "target_entity_type", "classified_type"]) {
    assert.ok(
      new RegExp(
        `DROP\\s+COLUMN\\s+(?:IF\\s+EXISTS\\s+)?${col}\\b`,
        "i"
      ).test(src),
      `down.sql must DROP COLUMN ${col}`
    );
  }
});

test("migration 00076 down.sql reverses policy renames (6 ALTER POLICY reverse renames)", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  const reversed = [
    ["document_extractions_org_read", "invoice_extractions_org_read"],
    ["document_extractions_org_write", "invoice_extractions_org_write"],
    ["document_extractions_org_update", "invoice_extractions_org_update"],
    ["document_extraction_lines_org_read", "iel_org_read"],
    ["document_extraction_lines_org_write", "iel_org_write"],
    ["document_extraction_lines_org_update", "iel_org_update"],
  ];
  for (const [newName, oldName] of reversed) {
    assert.ok(
      new RegExp(
        `ALTER\\s+POLICY\\s+${newName}\\s+ON\\s+public\\.\\w+\\s+RENAME\\s+TO\\s+${oldName}\\b`,
        "i"
      ).test(src),
      `down.sql must reverse policy rename ${newName} → ${oldName}`
    );
  }
});

test("migration 00076 down.sql reverses trigger renames (2)", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  assert.ok(
    /ALTER\s+TRIGGER\s+trg_document_extractions_touch\s+ON\s+public\.\w+\s+RENAME\s+TO\s+trg_invoice_extractions_touch\b/i.test(
      src
    ),
    "down.sql must reverse trg_document_extractions_touch → trg_invoice_extractions_touch"
  );
  assert.ok(
    /ALTER\s+TRIGGER\s+trg_document_extraction_lines_touch\s+ON\s+public\.\w+\s+RENAME\s+TO\s+trg_invoice_extraction_lines_touch\b/i.test(
      src
    ),
    "down.sql must reverse trg_document_extraction_lines_touch → trg_invoice_extraction_lines_touch"
  );
});

test("migration 00076 down.sql reverses index renames (5)", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  const reversed = [
    ["document_extractions_pkey", "invoice_extractions_pkey"],
    ["document_extraction_lines_pkey", "invoice_extraction_lines_pkey"],
    ["idx_document_extractions_invoice", "idx_invoice_extractions_invoice"],
    ["idx_document_extractions_pending", "idx_invoice_extractions_pending"],
    ["idx_document_extractions_status", "idx_invoice_extractions_status"],
  ];
  for (const [newName, oldName] of reversed) {
    assert.ok(
      new RegExp(
        `ALTER\\s+INDEX\\s+(?:public\\.)?${newName}\\s+RENAME\\s+TO\\s+${oldName}\\b`,
        "i"
      ).test(src),
      `down.sql must reverse index rename ${newName} → ${oldName}`
    );
  }
});

test("migration 00076 down.sql header documents data-loss note", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  assert.ok(
    /data[- ]loss|classifier|post[- ]Phase\s*3\.2|dropping.*column/i.test(src),
    "down.sql header must document the data-loss implication (dropping 3 new columns loses classifier data if any is written post-Phase 3.2)"
  );
});

// ── no hidden FK declarations anywhere ────────────────────────────────

test("migration 00076 has no REFERENCES clause for target_entity_id anywhere (Amendment E fence)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Strip -- line comments first. The header deliberately discusses the
  // absence of REFERENCES to document rationale — we only want to catch
  // an actual DDL REFERENCES on target_entity_id.
  const sqlOnly = src.replace(/--[^\n]*/g, "");
  assert.ok(
    !/target_entity_id[\s\S]{0,300}?REFERENCES\s+public\.\w+/i.test(sqlOnly),
    "target_entity_id must NOT have any REFERENCES declaration — app-layer integrity (Amendment E)"
  );
});

// ── runner ────────────────────────────────────────────────────────────

let failed = 0;
for (const c of cases) {
  try {
    c.fn();
    console.log(`PASS  ${c.name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${c.name}`);
    console.log(`      ${e instanceof Error ? e.message : String(e)}`);
  }
}
console.log("");
if (failed > 0) {
  console.error(`${failed} of ${cases.length} test(s) failed`);
  process.exit(1);
} else {
  console.log(`${cases.length} test(s) passed`);
}
