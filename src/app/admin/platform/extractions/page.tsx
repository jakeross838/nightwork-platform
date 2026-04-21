import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge, { type BadgeVariant } from "@/components/nw/Badge";

export const dynamic = "force-dynamic";

type ExtractionRow = {
  id: string;
  org_id: string;
  invoice_id: string;
  verification_status: string;
  verified_lines_count: number;
  total_lines_count: number;
  auto_committed: boolean;
  extracted_at: string;
  extraction_model: string | null;
  total_tokens_input: number | null;
  total_tokens_output: number | null;
  organizations: { name: string } | null;
  invoices: { id: string; invoice_number: string | null; vendor_name_raw: string | null } | null;
};

function statusVariant(status: string): BadgeVariant {
  if (status === "verified") return "success";
  if (status === "rejected") return "danger";
  if (status === "partial") return "warning";
  return "info";
}

export default async function PlatformExtractionsPage() {
  const supabase = createServerClient();

  const { data } = await supabase
    .from("invoice_extractions")
    .select("id, org_id, invoice_id, verification_status, verified_lines_count, total_lines_count, auto_committed, extracted_at, extraction_model, total_tokens_input, total_tokens_output, organizations(name), invoices(id, invoice_number, vendor_name_raw)")
    .is("deleted_at", null)
    .order("extracted_at", { ascending: false })
    .limit(300);

  const rows = (data ?? []) as unknown as ExtractionRow[];

  const tokens = rows.reduce(
    (acc, r) => ({
      in: acc.in + (r.total_tokens_input ?? 0),
      out: acc.out + (r.total_tokens_output ?? 0),
    }),
    { in: 0, out: 0 }
  );

  return (
    <div>
      <Eyebrow tone="accent">Cost Intelligence · Extractions</Eyebrow>
      <h1
        className="mt-2 text-[28px] tracking-[-0.02em]"
        style={{ fontFamily: "var(--font-space-grotesk)", color: "var(--text-primary)" }}
      >
        Invoice extractions
      </h1>
      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
        Cross-tenant view of every staged extraction. Monitor auto-commit behaviour and
        verification throughput.
      </p>

      <div className="mt-4 flex items-center gap-4 text-[11px] text-[var(--text-tertiary)]">
        <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
          Tokens: <span className="text-[var(--text-secondary)]">{tokens.in.toLocaleString("en-US")}</span> in ·{" "}
          <span className="text-[var(--text-secondary)]">{tokens.out.toLocaleString("en-US")}</span> out
        </span>
      </div>

      <div className="mt-6 border border-[var(--border-default)] bg-[var(--bg-card)]">
        <table className="w-full text-[12px]">
          <thead
            className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            <tr className="border-b border-[var(--border-default)]">
              <th className="text-left px-3 py-2 font-medium">Org</th>
              <th className="text-left px-3 py-2 font-medium">Extracted</th>
              <th className="text-left px-3 py-2 font-medium">Invoice</th>
              <th className="text-left px-3 py-2 font-medium">Vendor</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-right px-3 py-2 font-medium">Verified</th>
              <th className="text-right px-3 py-2 font-medium">Tokens in / out</th>
              <th className="text-left px-3 py-2 font-medium">Model</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[var(--text-tertiary)]">
                  No extractions recorded.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border-default)] last:border-b-0">
                  <td className="px-3 py-2 text-[var(--text-secondary)]">
                    {r.organizations?.name ?? r.org_id.slice(0, 8)}
                  </td>
                  <td
                    className="px-3 py-2 text-[var(--text-tertiary)]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    {new Date(r.extracted_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {r.invoices ? (
                      <Link
                        href={`/invoices/${r.invoices.id}`}
                        className="text-nw-gulf-blue hover:underline"
                      >
                        {r.invoices.invoice_number ?? r.invoices.id.slice(0, 8)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">
                    {r.invoices?.vendor_name_raw ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge variant={statusVariant(r.verification_status)} size="sm">
                        {r.verification_status}
                      </Badge>
                      {r.auto_committed ? (
                        <Badge variant="accent" size="sm">auto</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td
                    className="px-3 py-2 text-right text-[var(--text-secondary)]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {r.verified_lines_count} / {r.total_lines_count}
                  </td>
                  <td
                    className="px-3 py-2 text-right text-[var(--text-tertiary)]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {(r.total_tokens_input ?? 0).toLocaleString("en-US")} /{" "}
                    {(r.total_tokens_output ?? 0).toLocaleString("en-US")}
                  </td>
                  <td
                    className="px-3 py-2 text-[var(--text-tertiary)]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    {r.extraction_model ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
