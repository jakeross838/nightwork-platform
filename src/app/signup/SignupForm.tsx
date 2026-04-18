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
      className="w-full py-3 bg-slate-deep text-white-sand font-mono text-[11px] tracking-[0.14em] uppercase hover:bg-slate-deeper disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Creating account\u2026" : "Create Account"}
    </button>
  );
}

export default function SignupForm({ plan }: { plan: string | null }) {
  const [state, formAction] = useFormState(signupAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {plan && <input type="hidden" name="plan" value={plan} />}

      <Field label="Full Name" name="full_name" type="text" autoComplete="name" required />
      <Field label="Email Address" name="email" type="email" autoComplete="email" required />
      <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} hint="Minimum 8 characters" />
      <Field label="Company Name" name="company_name" type="text" autoComplete="organization" required />

      {state?.error && (
        <p className="text-[13px] text-nw-danger border border-nw-danger/40 bg-nw-danger/5 px-3 py-2 font-sans">
          {state.error}
        </p>
      )}

      <SubmitButton />

      <p className="font-mono text-[10px] tracking-[0.08em] text-center leading-relaxed" style={{ color: "rgba(59,88,100,0.5)" }}>
        By creating an account, you agree to our Terms of Service and Privacy
        Policy.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  hint,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="font-mono text-[10px] tracking-[0.12em] uppercase"
        style={{ color: "rgba(59,88,100,0.7)" }}
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        {...rest}
        className="px-[13px] py-[13px] border bg-white font-sans text-[14.5px] text-slate-deep focus:outline-none transition-all"
        style={{
          borderColor: "rgba(59,88,100,0.25)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#5B8699";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(91,134,153,0.1)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "rgba(59,88,100,0.25)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      {hint && (
        <span className="font-mono text-[9px] tracking-[0.08em]" style={{ color: "rgba(59,88,100,0.45)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}
