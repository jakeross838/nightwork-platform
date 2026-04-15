import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { PUBLIC_APP_NAME } from "@/lib/org/public";
import SignupForm from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { plan?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const plan = searchParams.plan ?? null;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <Link href="/" className="font-display text-lg tracking-[0.12em] uppercase text-cream">
            {PUBLIC_APP_NAME}
          </Link>
          <h1 className="mt-6 font-display text-3xl text-cream tracking-tight">
            Start building with {PUBLIC_APP_NAME}
          </h1>
          <p className="mt-2 text-sm text-cream-dim">
            14-day free trial. No credit card required.
          </p>
          {plan && (
            <p className="mt-3 inline-block px-3 py-1 border border-brand-border text-[11px] tracking-[0.08em] uppercase text-cream-dim">
              Selected plan: {plan}
            </p>
          )}
        </div>

        <div className="p-6 border border-brand-border bg-white">
          <SignupForm plan={plan} />
        </div>

        <p className="mt-6 text-center text-sm text-cream-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-teal hover:underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
