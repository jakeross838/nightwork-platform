import { createServerClient } from "@/lib/supabase/server";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";

export const dynamic = "force-dynamic";

type CorrectionRow = {
  id: string;
  org_id: string;
  source_text: string;
  ai_canonical_name: string | null;
  ai_created_via: string | null;
  ai_confidence: number | null;
  corrected_canonical_name: string | null;
  corrected_by: string | null;
  correction_notes: string | null;
  created_at: string;
  organizations: { name: string } | null;
  vendors: { name: string } | null;
};

export default async function PlatformClassificationsPage() {
  const supabase = createServerClient();

  const { data } = await supabase
    .from("item_classification_corrections")
    .select("id, org_id, source_text, ai_canonical_name, ai_created_via, ai_confidence, corrected_canonical_name, corrected_by, correction_notes, created_at, organizations(name), vendors(name)")
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as unknown as CorrectionRow[];

  return (
    <div>
      <Eyebrow tone="accent">Cost Intelligence · Corrections</Eyebrow>
      <h1
        className="mt-2 text-[28px] tracking-[-0.02em]"
        style={{ fontFamily: "var(--font-space-grotesk)", color: "var(--text-primary)" }}
      >
        Classification corrections
      </h1>
      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
        Every time a human rejected the AI&apos;s proposed item and fixed it. These rows feed
        back into the vendor context for future extractions.
      </p>

      <div className="mt-6 border border-[var(--border-default)] bg-[var(--bg-card)]">
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
                  No corrections recorded. Either no one has reviewed an extraction yet or
                  everyone is accepting the AI&apos;s classifications as-is.
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
    </div>
  );
}
