-- 00011_seed_active_jobs.sql
-- Seed the 6 currently-active Ross Built jobs (in addition to Drummond,
-- which was seeded in 00001). All jobs are cost_plus, 10% deposit,
-- 20% GC fee, status=active. TBD fields use 0 / placeholder and will
-- be updated later via the /jobs UI.
--
-- PM ids come from public.users (seeded in 00004). Krauss and Molinari
-- are intentionally unassigned (pm_id = NULL).
--
-- Idempotent: guarded by NOT EXISTS on the job name, so re-running
-- will not create duplicates.

INSERT INTO public.jobs (
  name, address, client_name, contract_type, original_contract_amount,
  current_contract_amount, pm_id, status, deposit_percentage,
  gc_fee_percentage, org_id
)
SELECT
  'Fish Residence',
  '715 N Shore Dr, Anna Maria, FL 34216',
  'Bill and Nicole Fish',
  'cost_plus',
  837000000,
  837000000,
  'a0000000-0000-0000-0000-000000000006'::uuid, -- Martin Mannix
  'active',
  0.10,
  0.20,
  '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.jobs WHERE name = 'Fish Residence' AND deleted_at IS NULL
);

INSERT INTO public.jobs (
  name, address, client_name, contract_type, original_contract_amount,
  current_contract_amount, pm_id, status, deposit_percentage,
  gc_fee_percentage, org_id
)
SELECT
  'Clark Residence',
  '853 N Shore Dr, Anna Maria, FL 34216',
  'Andrew and Siubhan Clark',
  'cost_plus',
  0,
  0,
  'a0000000-0000-0000-0000-000000000003'::uuid, -- Nelson Belanger
  'active',
  0.10,
  0.20,
  '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.jobs WHERE name = 'Clark Residence' AND deleted_at IS NULL
);

INSERT INTO public.jobs (
  name, address, client_name, contract_type, original_contract_amount,
  current_contract_amount, pm_id, status, deposit_percentage,
  gc_fee_percentage, org_id
)
SELECT
  'Pou Residence',
  '109 Seagrape Lane, Anna Maria, FL 34217',
  'Bill Pou',
  'cost_plus',
  0,
  0,
  'a0000000-0000-0000-0000-000000000007'::uuid, -- Jason Szykulski
  'active',
  0.10,
  0.20,
  '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.jobs WHERE name = 'Pou Residence' AND deleted_at IS NULL
);

INSERT INTO public.jobs (
  name, address, client_name, contract_type, original_contract_amount,
  current_contract_amount, pm_id, status, deposit_percentage,
  gc_fee_percentage, org_id
)
SELECT
  'Ruthven Residence',
  'Dream Island (full address TBD)',
  'Greg and Kim Ruthven',
  'cost_plus',
  0,
  0,
  'a0000000-0000-0000-0000-000000000002'::uuid, -- Lee Worthy
  'active',
  0.10,
  0.20,
  '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.jobs WHERE name = 'Ruthven Residence' AND deleted_at IS NULL
);

INSERT INTO public.jobs (
  name, address, client_name, contract_type, original_contract_amount,
  current_contract_amount, pm_id, status, deposit_percentage,
  gc_fee_percentage, org_id
)
SELECT
  'Krauss Residence',
  'TBD',
  'Krauss (full name TBD)',
  'cost_plus',
  0,
  0,
  NULL,
  'active',
  0.10,
  0.20,
  '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.jobs WHERE name = 'Krauss Residence' AND deleted_at IS NULL
);

INSERT INTO public.jobs (
  name, address, client_name, contract_type, original_contract_amount,
  current_contract_amount, pm_id, status, deposit_percentage,
  gc_fee_percentage, org_id
)
SELECT
  'Molinari Residence',
  'TBD',
  'Molinari (full name TBD)',
  'cost_plus',
  0,
  0,
  NULL,
  'active',
  0.10,
  0.20,
  '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.jobs WHERE name = 'Molinari Residence' AND deleted_at IS NULL
);
