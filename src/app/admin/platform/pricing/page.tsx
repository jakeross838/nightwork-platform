import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Money from "@/components/nw/Money";

export const dynamic = "force-dynamic";

type PricingRow = {
  id: string;
  org_id: string;
  vendor_id: string;
  item_id: string;
  unit_price_cents: number;
  quantity: number;
  total_cents: number;
  unit: string;
  source_type: string;
  transaction_date: string;
  ai_confidence: number | null;
  created_via: string | null;
  human_verified: boolean;
  auto_committed: boolean;
  organizations: { name: string } | null;
  vendors: { name: string } | null;
  items: { canonical_name: string } | null;
};

export default async function PlatformPricingPage() {
  const supabase = createServerClient();

  const { data } = await supabase
    .from("vendor_item_pricing")
    .select("id, org_id, vendor_id, item_id, unit_price_cents, quantity, total_cents, unit, source_type, transaction_date, ai_confidence, created_via, human_verified, auto_committed, organizations(name), vendors(name), items(canonical_name)")
    .is("deleted_at", null)
    .order("recorded_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as unknown as PricingRow[];

  return (
    <div>
      <Eyebrow tone="accent">Cost Intelligence · Spine</Eyebrow>
      <h1
        className="mt-2 text-[28px] tracking-[-0.02em]"
        style={{ fontFamily: "var(--font-space-grotesk)", color: "var(--text-primary)" }}
      >
        Vendor item pricing
      </h1>
      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
        Latest 500 rows across every tenant. Use this to audit how the spine is being
        populated and whether auto-commit is behaving reasonably.
      </p>

      <div className="mt-6 border border-[var(--border-default)] bg-[var(--bg-card)]">
        <table className="w-full text-[12px]">
          <thead
            className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            <tr className="border-b border-[var(--border-default)]">
              <th className="text-left px-3 py-2 font-medium">Org</th>
              <th className="text-left px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">Vendor</th>
              <th className="text-left px-3 py-2 font-medium">Item</th>
              <th className="text-right px-3 py-2 font-medium">Qty</th>
              <th className="text-right px-3 py-2 font-medium">Unit</th>
              <th className="text-right px-3 py-2 font-medium">Total</th>
              <th className="text-left px-3 py-2 font-medium">Source</th>
              <th className="text-left px-3 py-2 font-medium">Provenance</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-[var(--text-tertiary)]">
                  No pricing rows in the spine yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border-default)] last:border-b-0">
                  <td className="px-3 py-2 text-[var(--text-secondary)]">
                    {r.organizations?.name ?? r.org_id.slice(0, 8)}
                  </td>
                  <td
                    className="px-3 py-2 text-[var(--text-secondary)]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    {r.transaction_date}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{r.vendors?.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/platform/items/${r.item_id}`}
                      className="text-[var(--text-primary)] hover:text-nw-gulf-blue hover:underline"
                    >
                      {r.items?.canonical_name ?? "(unknown)"}
                    </Link>
                  </td>
                  <td
                    className="px-3 py-2 text-right text-[var(--text-secondary)]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {r.quantity} {r.unit}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money cents={r.unit_price_cents} size="sm" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money cents={r.total_cents} size="sm" />
                  </td>
                  <td className="px-3 py-2 text-[var(--text-tertiary)]">{r.source_type}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      {r.created_via && (
                        <Badge variant="neutral" size="sm">
                          {r.created_via.replace(/_/g, " ")}
                        </Badge>
                      )}
                      {r.human_verified ? (
                        <Badge variant="success" size="sm">verified</Badge>
                      ) : r.auto_committed ? (
                        <Badge variant="warning" size="sm">auto</Badge>
                      ) : null}
                    </div>
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
