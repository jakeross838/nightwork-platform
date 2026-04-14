-- 00008_seed_auth_users.sql
-- Seed the 9 internal-team auth users. Idempotent; password is temporary.
-- ids match public.users.id so auth.uid() === invoices.assigned_pm_id / jobs.pm_id.

DO $$
DECLARE
  v_password TEXT := 'RossBuilt2026!';
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT * FROM (VALUES
      ('a0000000-0000-0000-0000-000000000001'::uuid, 'jake@rossbuilt.com',    'Jake Ross',       'admin'),
      ('a0000000-0000-0000-0000-000000000009'::uuid, 'andrew@rossbuilt.com',  'Andrew Ross',     'admin'),
      ('a0000000-0000-0000-0000-000000000002'::uuid, 'lee@rossbuilt.com',     'Lee Worthy',      'pm'),
      ('a0000000-0000-0000-0000-000000000003'::uuid, 'nelson@rossbuilt.com',  'Nelson Belanger', 'pm'),
      ('a0000000-0000-0000-0000-000000000004'::uuid, 'bob@rossbuilt.com',     'Bob Mozine',      'pm'),
      ('a0000000-0000-0000-0000-000000000006'::uuid, 'martin@rossbuilt.com',  'Martin Mannix',   'pm'),
      ('a0000000-0000-0000-0000-000000000007'::uuid, 'jason@rossbuilt.com',   'Jason Szykulski', 'pm'),
      ('a0000000-0000-0000-0000-000000000005'::uuid, 'jeff@rossbuilt.com',    'Jeff Bryde',      'pm'),
      ('a0000000-0000-0000-0000-000000000008'::uuid, 'diane@rossbuilt.com',   'Diane',           'accounting')
    ) AS t(id, email, full_name, role)
  LOOP
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user.id,
      'authenticated',
      'authenticated',
      v_user.email,
      crypt(v_password, gen_salt('bf')),
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email'], 'role', v_user.role),
      jsonb_build_object('full_name', v_user.full_name),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    )
    ON CONFLICT (id) DO UPDATE SET
      raw_app_meta_data = EXCLUDED.raw_app_meta_data,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      email = EXCLUDED.email,
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
      updated_at = NOW();

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user.id,
      v_user.id::text,
      jsonb_build_object('sub', v_user.id::text, 'email', v_user.email, 'email_verified', true, 'phone_verified', false),
      'email',
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE SET
      identity_data = EXCLUDED.identity_data,
      updated_at = NOW();

    INSERT INTO public.profiles (id, full_name, email, role)
    VALUES (v_user.id, v_user.full_name, v_user.email, v_user.role)
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = NOW();
  END LOOP;
END $$;
