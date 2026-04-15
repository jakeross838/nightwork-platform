"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string } | undefined;

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Route based on onboarding state so existing users don't bounce through
  // the landing page on every sign-in. New orgs (or ones that ditched the
  // wizard halfway) go to /onboard; everyone else lands on /dashboard.
  if (user) {
    const { data: member } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (member?.org_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("onboarding_complete")
        .eq("id", member.org_id)
        .maybeSingle();
      if (org && !org.onboarding_complete) {
        redirect("/onboard");
      }
    }
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
