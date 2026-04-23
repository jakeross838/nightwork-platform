-- ============================================================
-- 00070_approval_chains.down.sql — reverses 00070
-- ============================================================
-- Strict reverse-dependency order:
--   1. Drop org-creation trigger on public.organizations
--      (depends on create_default_approval_chains()).
--   2. Drop create_default_approval_chains() function
--      (depends on default_stages_for_workflow_type(text)).
--   3. Drop the 3 RLS policies on approval_chains.
--   4. DISABLE RLS on approval_chains.
--   5. Drop the updated_at trigger.
--   6. Drop both partial unique indexes.
--   7. Drop public.approval_chains table.
--      (Table DROP implicitly reverses the one-time backfill —
--      3 orgs × 6 workflow_types = 18 rows discarded.)
--   8. Drop default_stages_for_workflow_type(text) helper LAST
--      (nothing else depends on it once the seed function is
--      gone).
-- ============================================================

-- (1) Drop org-creation trigger.
DROP TRIGGER IF EXISTS trg_organizations_create_default_approval_chains
  ON public.organizations;

-- (2) Drop seed function (depends on the helper).
DROP FUNCTION IF EXISTS public.create_default_approval_chains();

-- (3) Drop RLS policies (3 total — no DELETE policy exists so
--     not listed here). Reverse-declaration order: update →
--     insert → read.
DROP POLICY IF EXISTS approval_chains_org_update ON public.approval_chains;
DROP POLICY IF EXISTS approval_chains_org_insert ON public.approval_chains;
DROP POLICY IF EXISTS approval_chains_org_read   ON public.approval_chains;

-- (4) DISABLE RLS.
ALTER TABLE public.approval_chains DISABLE ROW LEVEL SECURITY;

-- (5) Drop updated_at trigger.
DROP TRIGGER IF EXISTS trg_approval_chains_updated_at
  ON public.approval_chains;

-- (6) Drop both partial unique indexes.
DROP INDEX IF EXISTS approval_chains_unique_name_per_workflow;
DROP INDEX IF EXISTS approval_chains_one_default_per_workflow;

-- (7) Drop table.
DROP TABLE IF EXISTS public.approval_chains;

-- (8) Drop helper LAST.
DROP FUNCTION IF EXISTS public.default_stages_for_workflow_type(text);
