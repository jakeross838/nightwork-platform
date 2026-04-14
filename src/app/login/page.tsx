import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
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
            Ross Command Center
          </h1>
          <p className="mt-2 text-sm text-cream-dim">
            Ross Built Custom Homes
          </p>
        </div>

        <div className="p-6 border border-brand-border bg-white">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-[11px] tracking-[0.08em] uppercase text-cream-dim">
          Est. 2006 &middot; Luxury Coastal Custom Homes
        </p>
      </div>
    </div>
  );
}
