"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = undefined;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full mt-2 py-3 bg-teal text-white font-display text-[13px] tracking-[0.1em] uppercase hover:bg-teal/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors rounded-none"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-[11px] tracking-[0.08em] uppercase text-cream-dim"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="px-3 py-2.5 border border-brand-border bg-white text-cream text-[14px] focus:outline-none focus:border-teal rounded-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-[11px] tracking-[0.08em] uppercase text-cream-dim"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="px-3 py-2.5 border border-brand-border bg-white text-cream text-[14px] focus:outline-none focus:border-teal rounded-none"
        />
      </div>

      <div className="text-right -mt-2">
        <a href="/forgot-password" className="text-[12px] text-teal hover:underline underline-offset-4">
          Forgot password?
        </a>
      </div>

      {state?.error && (
        <p className="text-[13px] text-status-danger border border-status-danger/40 bg-status-danger/5 px-3 py-2">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
