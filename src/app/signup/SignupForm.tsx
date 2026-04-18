"use client";

import { useFormState, useFormStatus } from "react-dom";
import { signupAction, type SignupState } from "./actions";

const initialState: SignupState = undefined;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full mt-2 py-3 bg-teal text-white font-display text-[13px] tracking-[0.1em] uppercase hover:bg-teal-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Creating account…" : "Create Account"}
    </button>
  );
}

export default function SignupForm({ plan }: { plan: string | null }) {
  const [state, formAction] = useFormState(signupAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {plan && <input type="hidden" name="plan" value={plan} />}
      <Field label="Full Name" name="full_name" type="text" autoComplete="name" required />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      <Field label="Company Name" name="company_name" type="text" autoComplete="organization" required />

      {state?.error && (
        <p className="text-[13px] text-status-danger border border-status-danger/40 bg-status-danger/5 px-3 py-2">
          {state.error}
        </p>
      )}

      <SubmitButton />
      <p className="text-[11px] text-cream-dim text-center leading-relaxed">
        By creating an account, you agree to our Terms of Service and Privacy Policy.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="text-[11px] tracking-[0.08em] uppercase text-cream-dim"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        {...rest}
        className="px-3 py-2.5 border border-brand-border bg-white text-cream text-[14px] focus:outline-none focus:border-teal"
      />
    </div>
  );
}
