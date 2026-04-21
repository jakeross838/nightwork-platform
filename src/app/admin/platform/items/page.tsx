import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Money from "@/components/nw/Money";

export const dynamic = "force-dynamic";

type ItemRow = {
  id: string;
  org_id: string;
  canonical_name: string;
  item_type: string;
  category: string | null;
  unit: string;
  ai_confidence: number | null;
  human_verified: boolean;
  created_at: string;
  organizations: { id: string; name: string } | null;
};

export default async function PlatformItemsPage() {
  const supabase = createServerClient();

  const { data: items } = await supabase
    .from("items")
    .select("id, org_id, canonical_name, item_type, category, unit, ai_confidence, human_verified, created_at, organizations(id, name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (items ?? []) as unknown as ItemRow[];

  // Per-org counts + total spend from vendor_item_pricing
  const { data: pricingRows } = await supabase
    .from("vendor_item_pricing")
    .select("item_id, total_cents")
    .is("deleted_at", null);

  const spendByItem = new Map<string, { total: number; count: number }>();
  for (const p of (pricingRows ?? []) as Array<{ item_id: string; total_cents: number }>) {
    const a = spendByItem.get(p.item_id) ?? { total: 0, count: 0 };
    a.total += p.total_cents ?? 0;
    a.count += 1;
    spendByItem.set(p.item_id, a);
  }

  return (
    <div>
      <Eyebrow tone="accent">Cost Intelligence · Items (cross-tenant)</Eyebrow>
      <h1
        className="mt-2 text-[28px] tracking-[-0.02em]"
        style={{ fontFamily: "var(--font-space-grotesk)", color: "var(--text-primary)" }}
      >
        Items
      </h1>
      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
        Every item across every org. Use this to spot duplicate items, bad classifications,
        or orgs missing cost intelligence activity.
      </p>

      <div className="mt-6 border border-[var(--border-default)] bg-[var(--bg-card)]">
        <table className="w-full text-[12px]">
          <thead
            className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            <tr className="border-b border-[var(--border-default)]">
              <th className="text-left px-3 py-2 font-medium">Org</th>
              <th className="text-left px-3 py-2 font-medium">Item</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-left px-3 py-2 font-medium">Unit</th>
              <th className="text-right px-3 py-2 font-medium">Pricing rows</th>
              <th className="text-right px-3 py-2 font-medium">Tracked spend</th>
              <th className="text-left px-3 py-2 font-medium">Verified</th>
              <th className="text-left px-3 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[var(--text-tertiary)]">
                  No items across any org yet.
                </td>
              </tr>
            ) : (
              rows.map((it) => {
                const s = spendByItem.get(it.id);
                return (
                  <tr key={it.id} className="border-b border-[var(--border-default)] last:border-b-0">
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {it.organizations?.name ?? it.org_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/platform/items/${it.id}`}
                        className="text-[var(--text-primary)] hover:text-nw-gulf-blue hover:underline"
                      >
                        {it.canonical_name}
                      </Link>
                      {it.category ? (
                        <div className="text-[10px] text-[var(--text-tertiary)]">{it.category}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{it.item_type}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{it.unit}</td>
                    <td
                      className="px-3 py-2 text-right text-[var(--text-secondary)]"
                      style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
                    >
                      {s?.count ?? 0}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Money cents={s?.total ?? 0} size="sm" />
                    </td>
                    <td className="px-3 py-2">
                      {it.human_verified ? (
                        <Badge variant="success" size="sm">verified</Badge>
                      ) : (
                        <Badge variant="warning" size="sm">unverified</Badge>
                      )}
                    </td>
                    <td
                      className="px-3 py-2 text-[var(--text-tertiary)]"
                      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                    >
                      {new Date(it.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
