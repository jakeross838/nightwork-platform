import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { PUBLIC_APP_NAME } from "@/lib/org/branding";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // If already signed in, bounce to the home screen.
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-cream tracking-tight">
            {PUBLIC_APP_NAME}
          </h1>
          <p className="mt-2 text-sm text-cream-dim">
            Construction operations, reimagined
          </p>
        </div>

        <div className="p-6 border border-brand-border bg-white">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
