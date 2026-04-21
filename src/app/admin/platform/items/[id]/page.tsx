import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Money from "@/components/nw/Money";

export const dynamic = "force-dynamic";

type Item = {
  id: string;
  org_id: string;
  canonical_name: string;
  description: string | null;
  item_type: string;
  category: string | null;
  subcategory: string | null;
  unit: string;
  specs: Record<string, unknown> | null;
  ai_confidence: number | null;
  human_verified: boolean;
  created_at: string;
  organizations: { name: string } | null;
};

type AliasRow = {
  id: string;
  alias_text: string;
  vendor_id: string | null;
  occurrence_count: number;
  vendors: { name: string } | null;
};

type PricingRow = {
  id: string;
  vendor_id: string;
  unit_price_cents: number;
  quantity: number;
  total_cents: number;
  transaction_date: string;
  created_via: string | null;
  human_verified: boolean;
  auto_committed: boolean;
  vendors: { name: string } | null;
};

export default async function AdminItemDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = createServerClient();

  const { data: itemData } = await supabase
    .from("items")
    .select("id, org_id, canonical_name, description, item_type, category, subcategory, unit, specs, ai_confidence, human_verified, created_at, organizations(name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!itemData) notFound();
  const item = itemData as unknown as Item;

  const [aliasRes, pricingRes] = await Promise.all([
    supabase
      .from("item_aliases")
      .select("id, alias_text, vendor_id, occurrence_count, vendors(name)")
      .eq("item_id", id)
      .order("occurrence_count", { ascending: false })
      .limit(100),
    supabase
      .from("vendor_item_pricing")
      .select("id, vendor_id, unit_price_cents, quantity, total_cents, transaction_date, created_via, human_verified, auto_committed, vendors(name)")
      .eq("item_id", id)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false })
      .limit(200),
  ]);

  const aliases = (aliasRes.data ?? []) as unknown as AliasRow[];
  const pricing = (pricingRes.data ?? []) as unknown as PricingRow[];

  return (
    <div>
      <Link
        href="/admin/platform/items"
        className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] hover:text-nw-gulf-blue"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        ← All items
      </Link>

      <div className="mt-4">
        <Eyebrow tone="accent">{item.organizations?.name ?? item.org_id}</Eyebrow>
        <h1
          className="mt-2 text-[24px] tracking-[-0.02em]"
          style={{ fontFamily: "var(--font-space-grotesk)", color: "var(--text-primary)" }}
        >
          {item.canonical_name}
        </h1>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Badge variant="neutral" size="sm">{item.item_type}</Badge>
          {item.category && <Badge variant="neutral" size="sm">{item.category}</Badge>}
          <Badge variant="neutral" size="sm">unit · {item.unit}</Badge>
          {item.human_verified ? (
            <Badge variant="success" size="sm">verified</Badge>
          ) : (
            <Badge variant="warning" size="sm">unverified</Badge>
          )}
          {item.ai_confidence != null && (
            <Badge variant="info" size="sm">AI {Math.round(item.ai_confidence * 100)}%</Badge>
          )}
        </div>
        {item.specs && Object.keys(item.specs).length > 0 ? (
          <pre
            className="mt-3 p-3 border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[11px] text-[var(--text-secondary)] overflow-auto"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {JSON.stringify(item.specs, null, 2)}
          </pre>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <Eyebrow tone="muted">Aliases ({aliases.length})</Eyebrow>
          <div className="mt-2 border border-[var(--border-default)] bg-[var(--bg-card)] divide-y divide-[var(--border-default)] max-h-[400px] overflow-auto">
            {aliases.length === 0 ? (
              <p className="p-4 text-[13px] text-[var(--text-tertiary)]">None.</p>
            ) : (
              aliases.map((a) => (
                <div key={a.id} className="p-2 text-[12px]">
                  <div
                    className="text-[var(--text-primary)]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    &ldquo;{a.alias_text}&rdquo;
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                    {a.vendors?.name ?? "any vendor"} · {a.occurrence_count}×
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <Eyebrow tone="muted">Pricing ({pricing.length})</Eyebrow>
          <div className="mt-2 border border-[var(--border-default)] bg-[var(--bg-card)] divide-y divide-[var(--border-default)] max-h-[400px] overflow-auto">
            {pricing.length === 0 ? (
              <p className="p-4 text-[13px] text-[var(--text-tertiary)]">None.</p>
            ) : (
              pricing.map((p) => (
                <div key={p.id} className="p-2 text-[12px] flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[var(--text-primary)]">{p.vendors?.name ?? "—"}</div>
                    <div
                      className="text-[11px] text-[var(--text-tertiary)]"
                      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                    >
                      {p.transaction_date} · {p.created_via ?? ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <Money cents={p.unit_price_cents} size="sm" />
                    <div className="text-[10px] text-[var(--text-tertiary)]">
                      {p.quantity} × → <Money cents={p.total_cents} size="sm" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
