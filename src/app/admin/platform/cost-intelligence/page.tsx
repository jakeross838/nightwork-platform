import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge, { type BadgeVariant } from "@/components/nw/Badge";
import Money from "@/components/nw/Money";
import BootstrapAliasesPanel from "@/components/admin/bootstrap-aliases-panel";

export const dynamic = "force-dynamic";

type Tab =
  | "items"
  | "pricing"
  | "extractions"
  | "classifications"
  | "conversions"
  | "bootstrap";

const TAB_ORDER: Array<{ key: Tab; label: string }> = [
  { key: "items", label: "Items" },
  { key: "pricing", label: "Pricing" },
  { key: "extractions", label: "Extractions" },
  { key: "classifications", label: "Classifications" },
  { key: "conversions", label: "Conversions" },
  { key: "bootstrap", label: "Bootstrap" },
];

function parseTab(v: string | string[] | undefined): Tab {
  const s = Array.isArray(v) ? v[0] : v;
  if (
    s === "pricing" ||
    s === "extractions" ||
    s === "classifications" ||
    s === "conversions" ||
    s === "bootstrap"
  ) {
    return s;
  }
  return "items";
}

export default async function PlatformCostIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab = parseTab(tabParam);

  return (
    <div>
      <Eyebrow tone="accent">Platform Admin · Cost Intelligence</Eyebrow>
      <h1
        className="mt-2 text-[28px] tracking-[-0.02em]"
        style={{ fontFamily: "var(--font-space-grotesk)", color: "var(--text-primary)" }}
      >
        Cost Intelligence
      </h1>
      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
        Cross-tenant view of every org&apos;s cost intelligence activity.
      </p>

      <TabNav active={tab} />

      <div className="mt-6">
        {tab === "items" && <ItemsTab />}
        {tab === "pricing" && <PricingTab />}
        {tab === "extractions" && <ExtractionsTab />}
        {tab === "classifications" && <ClassificationsTab />}
        {tab === "conversions" && <ConversionsTab />}
        {tab === "bootstrap" && <BootstrapTab />}
      </div>
    </div>
  );
}

function TabNav({ active }: { active: Tab }) {
  return (
    <div
      className="mt-6 flex items-center gap-1 overflow-x-auto sticky top-0 z-10 bg-[var(--bg-page)]"
      style={{ borderBottom: "1px solid var(--border-default)" }}
    >
      {TAB_ORDER.map((t) => {
        const isActive = t.key === active;
        const href = t.key === "items" ? "/admin/platform/cost-intelligence" : `/admin/platform/cost-intelligence?tab=${t.key}`;
        return (
          <Link
            key={t.key}
            href={href}
            className="relative px-3 py-2.5 text-[12px] font-medium transition-colors whitespace-nowrap"
            style={{
              color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
              letterSpacing: "0.02em",
            }}
          >
            {t.label}
            {isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-[2px]"
                style={{ background: "var(--nw-stone-blue)" }}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}

// ============================================================================
// ITEMS tab
// ============================================================================

type ItemRow = {
  id: string;
  org_id: string;
  canonical_name: string;
  item_type: string;
  category: string | null;
  unit: string;
  canonical_unit: string;
  ai_confidence: number | null;
  human_verified: boolean;
  created_at: string;
  organizations: { id: string; name: string } | null;
};

async function ItemsTab() {
  const supabase = createServerClient();
  const { data: items } = await supabase
    .from("items")
    .select(
      "id, org_id, canonical_name, item_type, category, unit, canonical_unit, ai_confidence, human_verified, created_at, organizations(id, name)"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (items ?? []) as unknown as ItemRow[];

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
    <div className="border border-[var(--border-default)] bg-[var(--bg-card)]">
      <table className="w-full text-[12px]">
        <thead
          className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          <tr className="border-b border-[var(--border-default)]">
            <th className="text-left px-3 py-2 font-medium">Org</th>
            <th className="text-left px-3 py-2 font-medium">Item</th>
            <th className="text-left px-3 py-2 font-medium">Type</th>
            <th className="text-left px-3 py-2 font-medium">Canonical unit</th>
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
                <tr
                  key={it.id}
                  className="border-b border-[var(--border-default)] last:border-b-0"
                >
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
                      <div className="text-[10px] text-[var(--text-tertiary)]">
                        {it.category}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{it.item_type}</td>
                  <td
                    className="px-3 py-2 text-[var(--text-secondary)]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    {it.canonical_unit}
                  </td>
                  <td
                    className="px-3 py-2 text-right text-[var(--text-secondary)]"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontVariantNumeric: "tabular-nums",
                    }}
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
  );
}

// ============================================================================
// PRICING tab
// ============================================================================

type PricingRowAdmin = {
  id: string;
  org_id: string;
  vendor_id: string;
  item_id: string;
  unit_price_cents: number;
  quantity: number;
  total_cents: number;
  unit: string;
  observed_unit: string | null;
  canonical_unit_price_cents: number | null;
  source_type: string;
  transaction_date: string;
  ai_confidence: number | null;
  created_via: string | null;
  human_verified: boolean;
  auto_committed: boolean;
  organizations: { name: string } | null;
  vendors: { name: string } | null;
  items: { canonical_name: string; canonical_unit: string } | null;
};

async function PricingTab() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("vendor_item_pricing")
    .select(
      "id, org_id, vendor_id, item_id, unit_price_cents, quantity, total_cents, unit, observed_unit, canonical_unit_price_cents, source_type, transaction_date, ai_confidence, created_via, human_verified, auto_committed, organizations(name), vendors(name), items(canonical_name, canonical_unit)"
    )
    .is("deleted_at", null)
    .order("recorded_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as unknown as PricingRowAdmin[];

  return (
    <div className="border border-[var(--border-default)] bg-[var(--bg-card)]">
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
            <th className="text-right px-3 py-2 font-medium">Observed</th>
            <th className="text-right px-3 py-2 font-medium">Canonical price</th>
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
                <td className="px-3 py-2 text-[var(--text-secondary)]">
                  {r.vendors?.name ?? "—"}
                </td>
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
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {r.quantity} {r.observed_unit ?? r.unit}
                </td>
                <td className="px-3 py-2 text-right">
                  <Money
                    cents={r.canonical_unit_price_cents ?? r.unit_price_cents}
                    size="sm"
                  />
                  {r.items?.canonical_unit && (
                    <div
                      className="text-[10px] text-[var(--text-tertiary)]"
                      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                    >
                      / {r.items.canonical_unit}
                    </div>
                  )}
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
  );
}

// ============================================================================
// EXTRACTIONS tab
// ============================================================================

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

async function ExtractionsTab() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("invoice_extractions")
    .select(
      "id, org_id, invoice_id, verification_status, verified_lines_count, total_lines_count, auto_committed, extracted_at, extraction_model, total_tokens_input, total_tokens_output, organizations(name), invoices(id, invoice_number, vendor_name_raw)"
    )
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
      <div className="mb-3 flex items-center gap-4 text-[11px] text-[var(--text-tertiary)]">
        <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
          Tokens:{" "}
          <span className="text-[var(--text-secondary)]">{tokens.in.toLocaleString("en-US")}</span> in ·{" "}
          <span className="text-[var(--text-secondary)]">{tokens.out.toLocaleString("en-US")}</span> out
        </span>
      </div>
      <div className="border border-[var(--border-default)] bg-[var(--bg-card)]">
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
                      {r.auto_committed ? <Badge variant="accent" size="sm">auto</Badge> : null}
                    </div>
                  </td>
                  <td
                    className="px-3 py-2 text-right text-[var(--text-secondary)]"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {r.verified_lines_count} / {r.total_lines_count}
                  </td>
                  <td
                    className="px-3 py-2 text-right text-[var(--text-tertiary)]"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontVariantNumeric: "tabular-nums",
                    }}
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

// ============================================================================
// CLASSIFICATIONS tab
// ============================================================================

type CorrectionRow = {
  id: string;
  org_id: string;
  source_text: string;
  ai_canonical_name: string | null;
  ai_created_via: string | null;
  ai_confidence: number | null;
  corrected_canonical_name: string | null;
  correction_notes: string | null;
  created_at: string;
  organizations: { name: string } | null;
  vendors: { name: string } | null;
};

async function ClassificationsTab() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("item_classification_corrections")
    .select(
      "id, org_id, source_text, ai_canonical_name, ai_created_via, ai_confidence, corrected_canonical_name, correction_notes, created_at, organizations(name), vendors(name)"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as unknown as CorrectionRow[];

  return (
    <div className="border border-[var(--border-default)] bg-[var(--bg-card)]">
      <table className="w-full text-[12px]">
        <thead
          className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          <tr className="border-b border-[var(--border-default)]">
            <th className="text-left px-3 py-2 font-medium">Date</th>
            <th className="text-left px-3 py-2 font-medium">Org</th>
            <th className="text-left px-3 py-2 font-medium">Vendor</th>
            <th className="text-left px-3 py-2 font-medium">Raw line</th>
            <th className="text-left px-3 py-2 font-medium">AI said</th>
            <th className="text-left px-3 py-2 font-medium">Human fixed to</th>
            <th className="text-left px-3 py-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-[var(--text-tertiary)]">
                No corrections recorded.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border-default)] last:border-b-0 align-top">
                <td
                  className="px-3 py-2 text-[var(--text-tertiary)] whitespace-nowrap"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">
                  {r.organizations?.name ?? r.org_id.slice(0, 8)}
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">
                  {r.vendors?.name ?? "—"}
                </td>
                <td
                  className="px-3 py-2 text-[var(--text-primary)] max-w-[240px]"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  {r.source_text}
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">
                  <div>{r.ai_canonical_name ?? "(none)"}</div>
                  <div className="mt-1 flex items-center gap-1">
                    {r.ai_created_via && (
                      <Badge variant="neutral" size="sm">
                        {r.ai_created_via.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {r.ai_confidence != null && (
                      <Badge variant="warning" size="sm">
                        {Math.round(r.ai_confidence * 100)}%
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-[var(--text-primary)] font-medium">
                  {r.corrected_canonical_name ?? "—"}
                </td>
                <td className="px-3 py-2 text-[11px] italic text-[var(--text-tertiary)] max-w-[240px]">
                  {r.correction_notes ?? "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// CONVERSIONS tab
// ============================================================================

type ConversionRowAdmin = {
  id: string;
  org_id: string;
  from_unit: string;
  to_unit: string;
  suggested_ratio: number;
  confirmed_ratio: number | null;
  status: string;
  ai_confidence: number | null;
  created_at: string;
  confirmed_at: string | null;
  items: { canonical_name: string } | null;
  organizations: { name: string } | null;
};

function conversionStatusVariant(s: string): BadgeVariant {
  if (s === "confirmed") return "success";
  if (s === "rejected") return "danger";
  if (s === "superseded") return "neutral";
  return "warning";
}

async function ConversionsTab() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("unit_conversion_suggestions")
    .select(
      "id, org_id, from_unit, to_unit, suggested_ratio, confirmed_ratio, status, ai_confidence, created_at, confirmed_at, items(canonical_name), organizations(name)"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as unknown as ConversionRowAdmin[];

  return (
    <div className="border border-[var(--border-default)] bg-[var(--bg-card)]">
      <table className="w-full text-[12px]">
        <thead
          className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          <tr className="border-b border-[var(--border-default)]">
            <th className="text-left px-3 py-2 font-medium">Date</th>
            <th className="text-left px-3 py-2 font-medium">Org</th>
            <th className="text-left px-3 py-2 font-medium">Item</th>
            <th className="text-left px-3 py-2 font-medium">Suggestion</th>
            <th className="text-right px-3 py-2 font-medium">Confidence</th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-[var(--text-tertiary)]">
                No unit conversion suggestions across any org.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border-default)] last:border-b-0">
                <td
                  className="px-3 py-2 text-[var(--text-tertiary)]"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">
                  {r.organizations?.name ?? r.org_id.slice(0, 8)}
                </td>
                <td className="px-3 py-2 text-[var(--text-primary)]">
                  {r.items?.canonical_name ?? "(unknown)"}
                </td>
                <td
                  className="px-3 py-2 text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  1 {r.from_unit} = {r.confirmed_ratio ?? r.suggested_ratio} {r.to_unit}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.ai_confidence != null ? (
                    <Badge
                      variant={
                        r.ai_confidence >= 0.85
                          ? "success"
                          : r.ai_confidence >= 0.7
                          ? "accent"
                          : "warning"
                      }
                      size="sm"
                    >
                      {Math.round(r.ai_confidence * 100)}%
                    </Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={conversionStatusVariant(r.status)} size="sm">
                    {r.status}
                  </Badge>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// BOOTSTRAP tab (admin-only batch commit of pending ai_new_item lines)
// ============================================================================

async function BootstrapTab() {
  const supabase = createServerClient();

  // Count pending ai_new_item lines per org so the picker shows
  // meaningful state. Include only orgs that have anything to bootstrap.
  const { data: pendingRows } = await supabase
    .from("invoice_extraction_lines")
    .select("org_id, classification_confidence, organizations(id, name)")
    .eq("verification_status", "pending")
    .eq("is_allocated_overhead", false)
    .eq("is_transaction_line", false)
    .eq("match_tier", "ai_new_item")
    .is("deleted_at", null);

  type Row = {
    org_id: string;
    classification_confidence: number | null;
    organizations: { id: string; name: string } | { id: string; name: string }[] | null;
  };
  const byOrg = new Map<string, { id: string; name: string; pending_count: number }>();
  for (const raw of (pendingRows ?? []) as Row[]) {
    const org = Array.isArray(raw.organizations) ? raw.organizations[0] : raw.organizations;
    if (!org) continue;
    const entry = byOrg.get(org.id) ?? { id: org.id, name: org.name, pending_count: 0 };
    entry.pending_count += 1;
    byOrg.set(org.id, entry);
  }
  const orgs = Array.from(byOrg.values()).sort((a, b) => b.pending_count - a.pending_count);

  return <BootstrapAliasesPanel orgs={orgs} />;
}
