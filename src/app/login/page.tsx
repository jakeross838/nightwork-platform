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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/nightwork-logo-light.svg"
            alt={PUBLIC_APP_NAME}
            style={{ width: "auto" }}
            className="mx-auto h-10 w-auto"
          />
          <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
            Sign in to {PUBLIC_APP_NAME}
          </p>
        </div>

        <div
          className="p-6 border"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-default)",
          }}
        >
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
          New to {PUBLIC_APP_NAME}?{" "}
          <a
            href="/signup"
            className="hover:underline underline-offset-4"
            style={{ color: "var(--nw-gulf-blue)" }}
          >
            Start a free trial
          </a>
        </p>
      </div>
    </div>
  );
}
