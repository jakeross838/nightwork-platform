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
      className="w-full py-3.5 bg-slate-deep text-white-sand font-mono text-[11px] tracking-[0.14em] uppercase font-medium hover:bg-slate-deeper disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150"
    >
      {pending ? "Signing in\u2026" : "Sign In \u2192"}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col">
      {/* Email field */}
      <div className="flex flex-col gap-2 mb-5">
        <label
          htmlFor="email"
          className="font-mono text-[10px] tracking-[0.12em] uppercase"
          style={{ color: "rgba(59,88,100,0.7)" }}
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="w-full px-3.5 py-[13px] bg-white border border-[rgba(59,88,100,0.25)] font-sans text-[14.5px] text-slate-tile placeholder:text-[rgba(59,88,100,0.4)] focus:outline-none transition-all duration-150 focus:border-stone-blue focus:shadow-[0_0_0_2px_rgba(91,134,153,0.12)]"
        />
      </div>

      {/* Password field */}
      <div className="flex flex-col gap-2 mb-5">
        <label
          htmlFor="password"
          className="font-mono text-[10px] tracking-[0.12em] uppercase"
          style={{ color: "rgba(59,88,100,0.7)" }}
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Your password"
          className="w-full px-3.5 py-[13px] bg-white border border-[rgba(59,88,100,0.25)] font-sans text-[14.5px] text-slate-tile placeholder:text-[rgba(59,88,100,0.4)] focus:outline-none transition-all duration-150 focus:border-stone-blue focus:shadow-[0_0_0_2px_rgba(91,134,153,0.12)]"
        />
      </div>

      {/* Remember me + Forgot row */}
      <div className="flex items-center justify-between mb-5">
        <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "rgba(59,88,100,0.8)" }}>
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            className="w-[15px] h-[15px]"
            style={{ accentColor: "#5B8699" }}
          />
          Stay signed in
        </label>
        <a
          href="/forgot-password"
          className="font-mono text-[11px] tracking-[0.1em] uppercase text-gulf-blue hover:underline transition-colors duration-150"
        >
          Forgot? &rarr;
        </a>
      </div>

      {/* Error message */}
      {state?.error && (
        <p className="text-[13px] text-nw-danger border border-nw-danger/40 bg-nw-danger/5 px-3 py-2 font-sans mb-4">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
