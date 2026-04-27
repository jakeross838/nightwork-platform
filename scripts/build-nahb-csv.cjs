#!/usr/bin/env node
// Build docs/canonical-codes/nahb-2024.csv from the raw Marion County BIA
// extracted source at docs/canonical-codes/nahb-2024-source.txt.
//
// Output schema: spine,code,parent_code,level,category,name,full_path
//
// Hierarchy is derived as:
//   Level 1 — 5 synthesized top-level categories (Product Definition, Land
//             Development, Direct Construction, Financing, Indirect
//             Construction) with synthetic codes NAHB-PD, NAHB-LD, NAHB-DC,
//             NAHB-FN, NAHB-IC.
//   Level 2 — anchored within each level-1 by either:
//             (a) ALL-CAPS name (e.g. "WATERPROOFING", "STEEL", "DRYWALL")
//             (b) round-number code in Land Development (codes ending in
//                 "0" within 02-01-01XX through 02-01-02XX)
//             (c) Synthesized when a level-1 has children with no natural
//                 anchor (e.g. "Permits and Fees" under Direct Construction)
//   Level 3 — leaf line items, parented to the most recent level-2 anchor
//             in the same level-1.
//
// Run:  node scripts/build-nahb-csv.cjs
//
// Idempotent — overwrites the CSV. If the source list changes, re-run and
// commit both files together.

const fs = require("fs");
const path = require("path");

const SOURCE_PATH = path.join(__dirname, "..", "docs", "canonical-codes", "nahb-2024-source.txt");
const OUTPUT_PATH = path.join(__dirname, "..", "docs", "canonical-codes", "nahb-2024.csv");
const MIGRATION_PATH = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "00082_canonical_cost_codes.sql"
);

// ---------------------------------------------------------------------------
// Level-1 categories
// ---------------------------------------------------------------------------
const LEVEL1 = {
  PD: { code: "NAHB-PD", name: "Product Definition" },
  LD: { code: "NAHB-LD", name: "Land Development" },
  DC: { code: "NAHB-DC", name: "Direct Construction" },
  FN: { code: "NAHB-FN", name: "Financing" },
  IC: { code: "NAHB-IC", name: "Indirect Construction" },
};

function level1ForCode(code) {
  // Product Definition: 01-01-XXXX
  if (code.startsWith("01-01-")) return "PD";

  // 02-01-0XXX where last4 < 1000 = Land Development (Pre-Acq → Sample Costs)
  if (code.startsWith("02-01-0")) {
    const last4 = parseInt(code.slice(6), 10);
    if (last4 < 1000) return "LD";
  }

  // 03-01-* = Direct Construction (Permits/Site)
  if (code.startsWith("03-01-")) return "DC";

  // 00-XX-* = Direct Construction (Trades)
  if (code.startsWith("00-")) return "DC";

  // 01-XX-* where 02 <= XX <= 64 = Direct Construction (Trades, Insulation,
  //   Drywall, Flooring, …, Walk-Through). 86-97 = Financing.
  if (code.startsWith("01-")) {
    const mid = parseInt(code.slice(3, 5), 10);
    if (mid >= 2 && mid <= 64) return "DC";
    if (mid >= 86 && mid <= 97) return "FN";
  }

  // 02-01-2XXX (Bank Processing Fees) is Financing, not Land Development.
  // 02-02 through 02-05 = Construction Finance Costs.
  if (code.startsWith("02-01-2")) return "FN";
  if (code.match(/^02-0[2-5]-/)) return "FN";

  // 02-23 through 02-58 = Indirect Construction
  if (code.startsWith("02-")) {
    const mid = parseInt(code.slice(3, 5), 10);
    if (mid >= 23 && mid <= 58) return "IC";
  }

  return null; // unmapped — script throws if any row is unmapped
}

// ---------------------------------------------------------------------------
// Synthesized level-2 anchors for sections that have no ALL-CAPS or
// round-number anchor in the source data.
// ---------------------------------------------------------------------------
const SYNTHESIZED_LEVEL2 = [
  // Land Development pre-acquisition costs (02-01-0101 through 02-01-0105)
  // have no natural anchor in the source — synthesize one.
  {
    code: "NAHB-LD-PREACQ",
    name: "Pre-Acquisition Costs",
    level1: "LD",
    insertBefore: "02-01-0101",
  },
  // Direct Construction permits/site/utility connections (03-01-1010 through
  // 03-01-1490) all live under Direct Construction but the source has no
  // single ALL-CAPS anchor — synthesize "Permits, Site & Utility Connections".
  {
    code: "NAHB-DC-PERMITS",
    name: "Permits, Site & Utility Connections",
    level1: "DC",
    insertBefore: "03-01-1010",
  },
  // Direct Construction excavation/foundation (00-04 through 00-09) — the
  // source has scattered material/labor rows but no ALL-CAPS anchor before
  // WATERPROOFING. Synthesize "Excavation & Foundation".
  {
    code: "NAHB-DC-EXCAV",
    name: "Excavation & Foundation",
    level1: "DC",
    insertBefore: "00-04-0239",
  },
  // Direct Construction framing (00-44 through 00-46) — STEEL header (00-40)
  // covers steel rows but the framing materials/labor block has no header.
  // Synthesize "Framing".
  {
    code: "NAHB-DC-FRAMING",
    name: "Framing",
    level1: "DC",
    insertBefore: "00-44-2006",
  },
  // Financing — Sales (01-86 through 01-87) has no ALL-CAPS anchor in source.
  {
    code: "NAHB-FN-SALES",
    name: "Sales",
    level1: "FN",
    insertBefore: "01-86-6481",
  },
  // Financing — Miscellaneous Revenue (01-90 through 01-91)
  {
    code: "NAHB-FN-MISCREV",
    name: "Miscellaneous Revenue",
    level1: "FN",
    insertBefore: "01-90-3005",
  },
  // Financing — Miscellaneous Costs (01-93 through 01-94)
  {
    code: "NAHB-FN-MISCCOST",
    name: "Miscellaneous Costs",
    level1: "FN",
    insertBefore: "01-93-9530",
  },
  // Financing — Commissions (01-97)
  {
    code: "NAHB-FN-COMMISSIONS",
    name: "Commissions",
    level1: "FN",
    insertBefore: "01-97-6054",
  },
  // Financing — Fees (02-01-2578 through 02-04-1798)
  {
    code: "NAHB-FN-FEES",
    name: "Fees",
    level1: "FN",
    insertBefore: "02-01-2578",
  },
  // Financing — Construction Finance Costs (02-04-9102, 02-05-6407)
  {
    code: "NAHB-FN-CONSTFIN",
    name: "Construction Finance Costs",
    level1: "FN",
    insertBefore: "02-04-9102",
  },
  // Indirect Construction — Salaries and Wages (02-23 through 02-26)
  {
    code: "NAHB-IC-SALARIES",
    name: "Salaries and Wages",
    level1: "IC",
    insertBefore: "02-23-1754",
  },
  // Indirect Construction — Payroll Taxes and Benefits (02-26-8278 through 02-28)
  {
    code: "NAHB-IC-PAYROLL",
    name: "Payroll Taxes and Benefits",
    level1: "IC",
    insertBefore: "02-26-8278",
  },
  // Indirect Construction — Field Office Expense (02-30 through 02-31)
  {
    code: "NAHB-IC-FIELDOFFICE",
    name: "Field Office Expense",
    level1: "IC",
    insertBefore: "02-30-4802",
  },
  // Indirect Construction — Field Warehouse and Storage (02-34 through 02-35)
  {
    code: "NAHB-IC-WAREHOUSE",
    name: "Field Warehouse and Storage",
    level1: "IC",
    insertBefore: "02-34-1326",
  },
  // Indirect Construction — Vehicles (02-37 through 02-39)
  {
    code: "NAHB-IC-VEHICLES",
    name: "Vehicles",
    level1: "IC",
    insertBefore: "02-37-7851",
  },
  // Indirect Construction — Field Equipment (02-41 through 02-42)
  {
    code: "NAHB-IC-EQUIPMENT",
    name: "Field Equipment",
    level1: "IC",
    insertBefore: "02-41-4375",
  },
  // Indirect Construction — Maintenance, Unsold Units (02-45 through 02-47)
  {
    code: "NAHB-IC-UNSOLD",
    name: "Maintenance — Unsold Units",
    level1: "IC",
    insertBefore: "02-45-0899",
  },
  // Indirect Construction — Warranty Costs (02-48 through 02-49)
  {
    code: "NAHB-IC-WARRANTY",
    name: "Warranty Costs",
    level1: "IC",
    insertBefore: "02-48-7423",
  },
  // Indirect Construction — Marketing Costs (02-52 through 02-53)
  {
    code: "NAHB-IC-MARKETING",
    name: "Marketing Costs",
    level1: "IC",
    insertBefore: "02-52-3948",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isAllCaps(name) {
  // ALL-CAPS check: contains at least one letter, all letters are uppercase.
  // Apostrophes / hyphens / spaces / numbers OK.
  if (!/[A-Z]/.test(name)) return false;
  return name === name.toUpperCase();
}

// Hardcoded list of Land Development section-header codes. Identified by
// inspecting the Marion County BIA source: each of these codes is followed
// in sequence by a tight block of child codes (e.g. 02-01-0140 "Earthwork"
// is followed by 02-01-0141..0153). Round-number codes that aren't
// followed by a +1 sibling (e.g. 02-01-0150 "Rock Removal" is just a leaf
// inside Earthwork) are NOT included.
const LD_LEVEL2_ANCHORS = new Set([
  "02-01-0110", // Land Acquisition Costs
  "02-01-0120", // Land Planning and Design
  "02-01-0130", // Engineering
  "02-01-0140", // Earthwork
  "02-01-0160", // Utilities
  "02-01-0180", // Streets and Walks
  "02-01-0200", // Signage
  "02-01-0210", // Landscaping
  "02-01-0220", // Amenities
  "02-01-0230", // Sample Costs
]);

function isLandDevelopmentRoundAnchor(code) {
  return LD_LEVEL2_ANCHORS.has(code);
}

// Construction abbreviations that stay uppercase when title-casing
// ALL-CAPS source rows (e.g. "ROUGH HVAC" → "Rough HVAC", not "Rough Hvac").
const KEEP_UPPER = new Set([
  "HVAC",
  "AC",
  "DC",
  "PVC",
  "LVL",
  "TJI",
  "OSB",
  "MDF",
  "GFCI",
]);

// Common short words that stay lowercase when title-casing (except as the
// first word of the name).
const KEEP_LOWER = new Set(["and", "or", "the", "of", "in", "on", "to", "a", "an", "for"]);

function titleCaseWithAbbrev(allCapsName) {
  return allCapsName
    .toLowerCase()
    .split(/(\s+)/)
    .map((tok, idx) => {
      if (/^\s+$/.test(tok)) return tok;
      const upper = tok.toUpperCase();
      if (KEEP_UPPER.has(upper)) return upper;
      if (idx > 0 && KEEP_LOWER.has(tok)) return tok;
      // Title-case but preserve hyphenated word boundaries
      return tok
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("-");
    })
    .join("");
}

function csvEscape(s) {
  if (s == null) return "";
  const str = String(s);
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const raw = fs.readFileSync(SOURCE_PATH, "utf-8");
  const sourceLines = raw
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("|"));

  // Parse source rows
  const sourceRows = sourceLines.map((l) => {
    const [code, ...rest] = l.split("|");
    const name = rest.join("|").trim();
    return { code: code.trim(), name };
  });

  // Splice synthesized level-2 anchors into position
  const orderedRows = [];
  const remaining = [...SYNTHESIZED_LEVEL2];
  for (const r of sourceRows) {
    // Insert any synthesized anchors that come right before this row
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (remaining[i].insertBefore === r.code) {
        const synth = remaining.splice(i, 1)[0];
        orderedRows.push({
          code: synth.code,
          name: synth.name,
          synthesized: true,
          level1: synth.level1,
        });
      }
    }
    orderedRows.push(r);
  }
  if (remaining.length > 0) {
    throw new Error(
      `Synthesized anchors not placed (insertBefore code missing in source): ${remaining
        .map((r) => r.code)
        .join(", ")}`
    );
  }

  // Walk and assign hierarchy
  const out = [];

  // 1. Level-1 rows
  for (const key of ["PD", "LD", "DC", "FN", "IC"]) {
    const l1 = LEVEL1[key];
    out.push({
      spine: "NAHB",
      code: l1.code,
      parent_code: "",
      level: 1,
      category: l1.name,
      name: l1.name,
      full_path: l1.name,
    });
  }

  // 2. Walk source rows, building level-2 / level-3
  let currentLevel2ByLevel1 = {}; // level1Key → most recent level-2 row
  for (const r of orderedRows) {
    let level1Key;
    let isLevel2 = false;

    if (r.synthesized) {
      level1Key = r.level1;
      isLevel2 = true;
    } else {
      level1Key = level1ForCode(r.code);
      if (!level1Key) {
        throw new Error(`Cannot map code ${r.code} (${r.name}) to a level-1 category`);
      }
      isLevel2 = isAllCaps(r.name) || isLandDevelopmentRoundAnchor(r.code);
    }

    const l1 = LEVEL1[level1Key];
    const cleanName = isAllCaps(r.name) ? titleCaseWithAbbrev(r.name) : r.name;

    if (isLevel2) {
      const row = {
        spine: "NAHB",
        code: r.code,
        parent_code: l1.code,
        level: 2,
        category: l1.name,
        name: cleanName,
        full_path: `${l1.name} / ${cleanName}`,
      };
      out.push(row);
      currentLevel2ByLevel1[level1Key] = row;
      continue;
    }

    // Level-3: parent is the most recent level-2 in same level-1, else level-1
    const parent = currentLevel2ByLevel1[level1Key];
    const parentCode = parent ? parent.code : l1.code;
    const parentName = parent ? parent.name : l1.name;
    out.push({
      spine: "NAHB",
      code: r.code,
      parent_code: parentCode,
      level: parent ? 3 : 2,
      category: l1.name,
      name: cleanName,
      full_path: parent
        ? `${l1.name} / ${parentName} / ${cleanName}`
        : `${l1.name} / ${cleanName}`,
    });
  }

  // Render CSV
  const header = ["spine", "code", "parent_code", "level", "category", "name", "full_path"];
  const lines = [header.join(",")];
  for (const row of out) {
    lines.push(
      header
        .map((h) => csvEscape(row[h]))
        .join(",")
    );
  }
  const csv = lines.join("\n") + "\n";

  fs.writeFileSync(OUTPUT_PATH, csv, "utf-8");

  // Generate the migration SQL alongside the CSV. DDL + RLS + seed data
  // in a single file. Idempotent via ON CONFLICT (spine, code) DO NOTHING.
  const migrationSql = renderMigrationSql(out);
  fs.writeFileSync(MIGRATION_PATH, migrationSql, "utf-8");

  // Stats
  const byLevel = { 1: 0, 2: 0, 3: 0 };
  const byCategory = {};
  for (const row of out) {
    byLevel[row.level] = (byLevel[row.level] ?? 0) + 1;
    byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
  }

  console.log(`✓ Wrote ${out.length} rows to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
  console.log(`✓ Wrote migration to ${path.relative(process.cwd(), MIGRATION_PATH)}`);
  console.log(`  Levels: L1=${byLevel[1]}, L2=${byLevel[2]}, L3=${byLevel[3]}`);
  console.log(`  By category:`);
  for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`    ${cat}: ${count}`);
  }
}

function sqlString(s) {
  if (s == null || s === "") return "NULL";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function renderMigrationSql(rows) {
  const ddl = `-- Migration 00082 — canonical cost codes table + NAHB seed
-- Phase 3.3 (Cost Intelligence Foundation) per amendment-1 + addendum-A.
-- Spine-agnostic schema: 'NAHB' shipped now; 'CSI' may be added later as a
-- separate spine value without migration changes.
--
-- Source for NAHB seed: docs/canonical-codes/nahb-2024-source.txt
-- (extracted from Marion County Building Industry Association's published
-- list of NAHB Standard Homebuilder Cost Codes — public domain reference
-- data). Hierarchy is derived in scripts/build-nahb-csv.cjs; the CSV at
-- docs/canonical-codes/nahb-2024.csv is the human-readable artifact.
--
-- Idempotent: re-applying this migration is a no-op via
-- ON CONFLICT (spine, code) DO NOTHING. Safe to run on a database that
-- already has the seed.

CREATE TABLE IF NOT EXISTS canonical_cost_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spine TEXT NOT NULL,
  code TEXT NOT NULL,
  parent_code TEXT,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  full_path TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (spine, code)
);

CREATE INDEX IF NOT EXISTS canonical_cost_codes_spine_code_idx
  ON canonical_cost_codes (spine, code);
CREATE INDEX IF NOT EXISTS canonical_cost_codes_spine_parent_idx
  ON canonical_cost_codes (spine, parent_code);
CREATE INDEX IF NOT EXISTS canonical_cost_codes_spine_category_idx
  ON canonical_cost_codes (spine, category);

ALTER TABLE canonical_cost_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_cost_codes FORCE ROW LEVEL SECURITY;

-- Read-only to all authenticated users. No INSERT/UPDATE/DELETE policies —
-- this is global reference data, modifiable only via migrations
-- (mirrors the cost_intelligence_spine 00052 RLS precedent: explicit
-- positive policy for reads, omit explicit policies for writes so RLS
-- blocks them by default).
DROP POLICY IF EXISTS canonical_cost_codes_read_all_authenticated ON canonical_cost_codes;
CREATE POLICY canonical_cost_codes_read_all_authenticated
  ON canonical_cost_codes FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE canonical_cost_codes IS
  'Global reference table of canonical cost codes across multiple spines (NAHB v1; CSI added later when licensed). Read-only to all authenticated users; modifiable only via migrations.';

-- Seed data (NAHB spine).
`;

  // Build a single INSERT ... VALUES with ON CONFLICT to keep the migration
  // file deterministic and small. Postgres tolerates very large VALUES lists
  // — 354 rows is far below any practical limit.
  const values = rows
    .map((r) => {
      const cells = [
        sqlString(r.spine),
        sqlString(r.code),
        sqlString(r.parent_code || null),
        String(r.level),
        sqlString(r.category),
        sqlString(r.name),
        sqlString(r.full_path),
      ];
      return `  (${cells.join(", ")})`;
    })
    .join(",\n");

  const insertSql = `INSERT INTO canonical_cost_codes
  (spine, code, parent_code, level, category, name, full_path)
VALUES
${values}
ON CONFLICT (spine, code) DO NOTHING;
`;

  return ddl + insertSql;
}

main();
