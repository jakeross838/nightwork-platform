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
          <Link href="/" className="inline-block" aria-label={PUBLIC_APP_NAME}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/nightwork-logo-light.svg"
              alt={PUBLIC_APP_NAME}
              style={{ width: "auto" }}
              className="mx-auto h-10 w-auto"
            />
          </Link>
          <h1
            className="m-0 mt-6"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 500,
              fontSize: "28px",
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            Create your {PUBLIC_APP_NAME} account
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            14-day free trial. No credit card required.
          </p>
          {plan && (
            <p
              className="mt-3 inline-block px-3 py-1 border text-[11px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                borderColor: "var(--border-default)",
                color: "var(--text-tertiary)",
              }}
            >
              Selected plan: {plan}
            </p>
          )}
        </div>

        <div
          className="p-6 border"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-default)",
          }}
        >
          <SignupForm plan={plan} />
        </div>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
          Already have an account?{" "}
          <Link
            href="/login"
            className="hover:underline underline-offset-4"
            style={{ color: "var(--nw-gulf-blue)" }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
