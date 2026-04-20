"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Org = {
  id: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  company_address: string | null;
  company_city: string | null;
  company_state: string | null;
  company_zip: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_website: string | null;
};

export default function CompanySettingsForm({ org }: { org: Org }) {
  const router = useRouter();
  const [form, setForm] = useState<Org>(org);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof Org>(key: K, value: Org[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/organizations/current", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          tagline: form.tagline,
          company_address: form.company_address,
          company_city: form.company_city,
          company_state: form.company_state,
          company_zip: form.company_zip,
          company_phone: form.company_phone,
          company_email: form.company_email,
          company_website: form.company_website,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Save failed (${res.status})`);
      }
      setMessage({ kind: "ok", text: "Saved." });
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/organizations/logo", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Upload failed (${res.status})`);
      }
      const { logo_url } = (await res.json()) as { logo_url: string };
      update("logo_url", logo_url);
      setMessage({ kind: "ok", text: "Logo uploaded." });
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="space-y-6">
        <Section title="Company Info">
          <Field label="Company Name" value={form.name} onChange={(v) => update("name", v)} />
          <Field
            label="Tagline"
            value={form.tagline ?? ""}
            onChange={(v) => update("tagline", v)}
            placeholder="Shown under the dashboard hero (optional)"
          />
          <Field
            label="Address"
            value={form.company_address ?? ""}
            onChange={(v) => update("company_address", v)}
          />
          <div className="grid grid-cols-3 gap-3">
            <Field
              label="City"
              value={form.company_city ?? ""}
              onChange={(v) => update("company_city", v)}
            />
            <Field
              label="State"
              value={form.company_state ?? ""}
              onChange={(v) => update("company_state", v)}
            />
            <Field
              label="ZIP"
              value={form.company_zip ?? ""}
              onChange={(v) => update("company_zip", v)}
            />
          </div>
          <Field
            label="Phone"
            value={form.company_phone ?? ""}
            onChange={(v) => update("company_phone", v)}
          />
          <Field
            label="Email"
            type="email"
            value={form.company_email ?? ""}
            onChange={(v) => update("company_email", v)}
          />
          <Field
            label="Website"
            value={form.company_website ?? ""}
            onChange={(v) => update("company_website", v)}
            placeholder="https://example.com"
          />
        </Section>

        <Section title="Logo">
          <div className="flex items-center gap-4">
            <div
              className="h-16 w-40 flex items-center justify-center border"
              style={{
                background: "var(--nw-slate-deep)",
                borderColor: "var(--border-default)",
              }}
            >
              {form.logo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={form.logo_url}
                  alt={form.name}
                  className="max-h-12 max-w-[140px] object-contain"
                />
              ) : (
                <span
                  className="text-xs uppercase"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    letterSpacing: "0.14em",
                    color: "var(--nw-white-sand)",
                  }}
                >
                  No logo
                </span>
              )}
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={onLogoChange}
                className="text-sm"
              />
              <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                PNG, JPG, SVG, or WebP. Displays at 32px tall in the nav.
              </p>
              {uploading && (
                <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                  Uploading…
                </p>
              )}
            </div>
          </div>
        </Section>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="h-[36px] px-4 text-[11px] uppercase disabled:opacity-60 nw-primary-btn"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {message && (
            <span
              className={`text-xs tracking-[0.04em] ${
                message.kind === "ok" ? "text-status-success" : "text-status-danger"
              }`}
            >
              {message.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="border p-5"
      style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}
    >
      <h2
        className="m-0 mb-3 text-[10px] uppercase"
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          letterSpacing: "0.14em",
          color: "var(--text-tertiary)",
        }}
      >
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
      <style jsx>{`
        :global(.nw-eyebrow) {
          font-family: var(--font-jetbrains-mono);
          letter-spacing: 0.14em;
          color: var(--text-tertiary);
        }
        :global(.nw-input) {
          background: var(--bg-subtle);
          border-color: var(--border-default);
          color: var(--text-primary);
        }
        :global(.nw-input:focus) {
          outline: none;
          border-color: var(--nw-stone-blue);
        }
        :global(.nw-primary-btn) {
          font-family: var(--font-jetbrains-mono);
          letter-spacing: 0.12em;
          font-weight: 500;
          background: var(--nw-stone-blue);
          color: var(--nw-white-sand);
          border: 1px solid var(--nw-stone-blue);
        }
        :global(.nw-primary-btn:hover:not(:disabled)) {
          background: var(--nw-gulf-blue);
          border-color: var(--nw-gulf-blue);
        }
      `}</style>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[0.08em] uppercase text-cream-dim mb-1">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-brand-border bg-white text-sm text-cream focus-teal"
      />
    </label>
  );
}
