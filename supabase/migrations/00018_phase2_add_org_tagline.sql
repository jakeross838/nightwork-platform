-- Phase 2 — Add tagline column to organizations.
-- Preserves the Ross Built landing page copy ("Bradenton • Anna Maria
-- Island • Est. 2006 • Luxury Coastal Custom Homes") as editable data
-- instead of hardcoded JSX, while leaving the column null for new orgs.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS tagline TEXT;

UPDATE public.organizations
SET tagline =
  'Bradenton '    || chr(8226) ||
  ' Anna Maria Island ' || chr(8226) ||
  ' Est. 2006 '   || chr(8226) ||
  ' Luxury Coastal Custom Homes'
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND tagline IS NULL;
