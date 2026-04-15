-- Phase 1 — Multi-Tenant Foundation
-- Introduces the organizations + org_members tables, migrates Ross Built
-- into the first organization record, adds FK constraints + defense-in-depth
-- org isolation RLS, and a user_org_id() session helper.
--
-- The placeholder UUID 00000000-0000-0000-0000-000000000001 was used as the
-- single-tenant org_id on every existing row. We adopt it as Ross Built's
-- canonical organization id so no backfill UPDATE is required.

-- 1. organizations -----------------------------------------------------------
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  company_address TEXT,
  company_city TEXT,
  company_state TEXT,
  company_zip TEXT,
  company_phone TEXT,
  company_email TEXT,
  company_website TEXT,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#3F5862',
  accent_color TEXT,
  default_gc_fee_percentage NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  default_deposit_percentage NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  payment_schedule_type TEXT NOT NULL DEFAULT '5_20'
    CHECK (payment_schedule_type IN ('5_20','15_30','monthly','custom')),
  payment_schedule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  subscription_plan TEXT NOT NULL DEFAULT 'free_trial'
    CHECK (subscription_plan IN ('free_trial','starter','professional','enterprise')),
  subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('trialing','active','past_due','cancelled')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  ai_calls_this_month INTEGER NOT NULL DEFAULT 0,
  ai_calls_limit INTEGER NOT NULL DEFAULT 100,
  storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Seed Ross Built as the first organization ------------------------------
INSERT INTO public.organizations (
  id, name, slug,
  company_address, company_city, company_state,
  subscription_plan, subscription_status,
  default_gc_fee_percentage, default_deposit_percentage,
  payment_schedule_type,
  ai_calls_limit
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Ross Built Custom Homes',
  'ross-built',
  '305 67th St West',
  'Bradenton',
  'FL',
  'enterprise',
  'active',
  0.20,
  0.10,
  '5_20',
  999999
);

-- 3. FK from every existing org_id column to organizations.id ----------------
ALTER TABLE public.budget_lines       ADD CONSTRAINT budget_lines_org_id_fkey       FOREIGN KEY (org_id) REFERENCES public.organizations(id);
ALTER TABLE public.change_orders      ADD CONSTRAINT change_orders_org_id_fkey      FOREIGN KEY (org_id) REFERENCES public.organizations(id);
ALTER TABLE public.cost_codes         ADD CONSTRAINT cost_codes_org_id_fkey         FOREIGN KEY (org_id) REFERENCES public.organizations(id);
ALTER TABLE public.draw_line_items    ADD CONSTRAINT draw_line_items_org_id_fkey    FOREIGN KEY (org_id) REFERENCES public.organizations(id);
ALTER TABLE public.draws              ADD CONSTRAINT draws_org_id_fkey              FOREIGN KEY (org_id) REFERENCES public.organizations(id);
ALTER TABLE public.invoice_line_items ADD CONSTRAINT invoice_line_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);
ALTER TABLE public.invoices           ADD CONSTRAINT invoices_org_id_fkey           FOREIGN KEY (org_id) REFERENCES public.organizations(id);
ALTER TABLE public.jobs               ADD CONSTRAINT jobs_org_id_fkey               FOREIGN KEY (org_id) REFERENCES public.organizations(id);
ALTER TABLE public.purchase_orders    ADD CONSTRAINT purchase_orders_org_id_fkey    FOREIGN KEY (org_id) REFERENCES public.organizations(id);
ALTER TABLE public.users              ADD CONSTRAINT users_org_id_fkey              FOREIGN KEY (org_id) REFERENCES public.organizations(id);
ALTER TABLE public.vendors            ADD CONSTRAINT vendors_org_id_fkey            FOREIGN KEY (org_id) REFERENCES public.organizations(id);

-- 4. profiles.org_id ---------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN org_id UUID REFERENCES public.organizations(id);
UPDATE public.profiles SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
ALTER TABLE public.profiles ALTER COLUMN org_id SET NOT NULL;

-- 5. org_members -------------------------------------------------------------
CREATE TABLE public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','pm','accounting')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE TRIGGER trg_org_members_updated_at
  BEFORE UPDATE ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- Populate org_members from existing profiles. jakeross838@gmail.com is the
-- Ross Built owner; everyone else keeps their current role.
INSERT INTO public.org_members (org_id, user_id, role, accepted_at, is_active)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  CASE WHEN p.email = 'jakeross838@gmail.com' THEN 'owner' ELSE p.role END,
  p.created_at,
  TRUE
FROM public.profiles p;

-- 6. Session helper ----------------------------------------------------------
CREATE OR REPLACE FUNCTION app_private.user_org_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION app_private.user_org_id() TO authenticated;

-- 7. RLS on new tables -------------------------------------------------------
CREATE POLICY "members read own org" ON public.organizations
  FOR SELECT USING (id = app_private.user_org_id());
CREATE POLICY "admin update own org" ON public.organizations
  FOR UPDATE
  USING (id = app_private.user_org_id() AND app_private.user_role() IN ('admin','owner'))
  WITH CHECK (id = app_private.user_org_id() AND app_private.user_role() IN ('admin','owner'));

CREATE POLICY "members read org_members" ON public.org_members
  FOR SELECT USING (org_id = app_private.user_org_id());
CREATE POLICY "admin manage org_members" ON public.org_members
  FOR ALL
  USING (org_id = app_private.user_org_id() AND app_private.user_role() IN ('admin','owner'))
  WITH CHECK (org_id = app_private.user_org_id() AND app_private.user_role() IN ('admin','owner'));

-- 8. Defense-in-depth org isolation (RESTRICTIVE layers on top of existing
-- role-based policies without replacing them). Today every row and every
-- user belongs to the Ross Built org, so these evaluate true everywhere.
CREATE POLICY "org isolation" ON public.budget_lines       AS RESTRICTIVE FOR ALL USING (org_id = app_private.user_org_id()) WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "org isolation" ON public.change_orders      AS RESTRICTIVE FOR ALL USING (org_id = app_private.user_org_id()) WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "org isolation" ON public.cost_codes         AS RESTRICTIVE FOR ALL USING (org_id = app_private.user_org_id()) WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "org isolation" ON public.draws              AS RESTRICTIVE FOR ALL USING (org_id = app_private.user_org_id()) WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "org isolation" ON public.draw_line_items    AS RESTRICTIVE FOR ALL USING (org_id = app_private.user_org_id()) WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "org isolation" ON public.invoices           AS RESTRICTIVE FOR ALL USING (org_id = app_private.user_org_id()) WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "org isolation" ON public.invoice_line_items AS RESTRICTIVE FOR ALL USING (org_id = app_private.user_org_id()) WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "org isolation" ON public.jobs               AS RESTRICTIVE FOR ALL USING (org_id = app_private.user_org_id()) WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "org isolation" ON public.purchase_orders    AS RESTRICTIVE FOR ALL USING (org_id = app_private.user_org_id()) WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "org isolation" ON public.users              AS RESTRICTIVE FOR ALL USING (org_id = app_private.user_org_id()) WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "org isolation" ON public.vendors            AS RESTRICTIVE FOR ALL USING (org_id = app_private.user_org_id()) WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "org isolation" ON public.profiles           AS RESTRICTIVE FOR ALL USING (org_id = app_private.user_org_id()) WITH CHECK (org_id = app_private.user_org_id());

-- 9. Indexes on org_id for future multi-tenant query performance -------------
CREATE INDEX IF NOT EXISTS idx_jobs_org_id               ON public.jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_id           ON public.invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_org_id ON public.invoice_line_items(org_id);
CREATE INDEX IF NOT EXISTS idx_vendors_org_id            ON public.vendors(org_id);
CREATE INDEX IF NOT EXISTS idx_cost_codes_org_id         ON public.cost_codes(org_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_org_id       ON public.budget_lines(org_id);
CREATE INDEX IF NOT EXISTS idx_draws_org_id              ON public.draws(org_id);
CREATE INDEX IF NOT EXISTS idx_draw_line_items_org_id    ON public.draw_line_items(org_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_id    ON public.purchase_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_org_id      ON public.change_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id           ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id       ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id        ON public.org_members(org_id);
