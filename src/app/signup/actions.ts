"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export type SignupState = { error?: string } | undefined;

export async function signupAction(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const companyName = String(formData.get("company_name") ?? "").trim();

  if (!fullName || !email || !password || !companyName) {
    return { error: "All fields are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = createServerClient();

  // create_signup is a SECURITY DEFINER RPC that atomically creates the
  // auth user (pre-confirmed), profile row, organization, and owner
  // membership. See supabase/migrations/00023_phase3_sql_signup.sql.
  const { error: rpcErr } = await supabase.rpc("create_signup", {
    p_email: email,
    p_password: password,
    p_full_name: fullName,
    p_company_name: companyName,
  });
  if (rpcErr) {
    if (rpcErr.code === "23505" || /already exists/i.test(rpcErr.message)) {
      return { error: "An account with that email already exists." };
    }
    return { error: `Sign-up failed: ${rpcErr.message}` };
  }

  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) {
    return { error: `Account created but sign-in failed: ${signInErr.message}` };
  }

  redirect("/onboard");
}
