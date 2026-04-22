-- 00062_assert_created_by_columns.sql
-- Branch 1 Phase 1.4 — Missing `created_by` Columns (assert-only).
--
-- The Phase 1.4 spec was written assuming `created_by` was missing on
-- cost_codes, budget_lines, and draw_line_items. The R.18 blast-radius
-- check at kickoff revealed migration 00045 already added the columns
-- (and the matching FK to auth.users). So this migration adds nothing
-- to the schema — it acts as a tripwire instead: six DO-block assertions
-- (3 columns + 3 foreign keys) that fail loudly if someone ever drops
-- one in the future.
--
-- created_by is nullable by design. Inserts from user-authenticated routes
-- must populate it. Inserts from system routes (seed data, cron, batch
-- import without session) may leave it NULL, and status_history or
-- activity_log should record the system actor instead. The audit-site
-- patches in this same Phase 1.4 commit make this convention explicit per
-- file: either `created_by: user.id` is set, or a `// no user session:`
-- comment documents why NULL is acceptable.
--
-- Idempotent: every assertion is a SELECT-then-RAISE. Re-running the
-- migration is a no-op when the schema is healthy.

-- ─── Column existence assertions ────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'cost_codes'
       AND column_name = 'created_by'
  ) THEN
    RAISE EXCEPTION 'cost_codes.created_by column missing — was 00045 dropped?';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'budget_lines'
       AND column_name = 'created_by'
  ) THEN
    RAISE EXCEPTION 'budget_lines.created_by column missing — was 00045 dropped?';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'draw_line_items'
       AND column_name = 'created_by'
  ) THEN
    RAISE EXCEPTION 'draw_line_items.created_by column missing — was 00045 dropped?';
  END IF;
END $$;

-- ─── Foreign-key assertions (created_by → auth.users.id) ────────────
-- pg_constraint is the most precise lookup; we walk the FK and confirm
-- both endpoints. Each query below should return exactly one row when
-- the FK exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class src ON src.oid = c.conrelid
      JOIN pg_namespace srcns ON srcns.oid = src.relnamespace
      JOIN pg_class tgt ON tgt.oid = c.confrelid
      JOIN pg_namespace tgtns ON tgtns.oid = tgt.relnamespace
     WHERE c.contype = 'f'
       AND srcns.nspname = 'public'
       AND src.relname = 'cost_codes'
       AND tgtns.nspname = 'auth'
       AND tgt.relname = 'users'
       AND EXISTS (
         SELECT 1 FROM unnest(c.conkey) AS k
          WHERE (
            SELECT attname FROM pg_attribute
             WHERE attrelid = c.conrelid AND attnum = k
          ) = 'created_by'
       )
  ) THEN
    RAISE EXCEPTION 'cost_codes FK created_by → auth.users(id) missing';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class src ON src.oid = c.conrelid
      JOIN pg_namespace srcns ON srcns.oid = src.relnamespace
      JOIN pg_class tgt ON tgt.oid = c.confrelid
      JOIN pg_namespace tgtns ON tgtns.oid = tgt.relnamespace
     WHERE c.contype = 'f'
       AND srcns.nspname = 'public'
       AND src.relname = 'budget_lines'
       AND tgtns.nspname = 'auth'
       AND tgt.relname = 'users'
       AND EXISTS (
         SELECT 1 FROM unnest(c.conkey) AS k
          WHERE (
            SELECT attname FROM pg_attribute
             WHERE attrelid = c.conrelid AND attnum = k
          ) = 'created_by'
       )
  ) THEN
    RAISE EXCEPTION 'budget_lines FK created_by → auth.users(id) missing';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class src ON src.oid = c.conrelid
      JOIN pg_namespace srcns ON srcns.oid = src.relnamespace
      JOIN pg_class tgt ON tgt.oid = c.confrelid
      JOIN pg_namespace tgtns ON tgtns.oid = tgt.relnamespace
     WHERE c.contype = 'f'
       AND srcns.nspname = 'public'
       AND src.relname = 'draw_line_items'
       AND tgtns.nspname = 'auth'
       AND tgt.relname = 'users'
       AND EXISTS (
         SELECT 1 FROM unnest(c.conkey) AS k
          WHERE (
            SELECT attname FROM pg_attribute
             WHERE attrelid = c.conrelid AND attnum = k
          ) = 'created_by'
       )
  ) THEN
    RAISE EXCEPTION 'draw_line_items FK created_by → auth.users(id) missing';
  END IF;
END $$;
