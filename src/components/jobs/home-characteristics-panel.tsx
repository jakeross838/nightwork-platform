"use client";

import { useCallback, useEffect, useState } from "react";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwButton from "@/components/nw/Button";
import NwBadge from "@/components/nw/Badge";
import { toast } from "@/lib/utils/toast";

type FinishLevel = "production" | "semi_custom" | "custom" | "luxury" | "ultra_luxury";
type ConstructionType = "wood_frame" | "cmu" | "cmu_wood_hybrid" | "timber_frame" | "icf" | "steel_frame";

interface HomeCharacteristics {
  heated_sf: number | null;
  total_sf: number | null;
  bedroom_count: number | null;
  bathroom_count: number | null;
  half_bathroom_count: number | null;
  story_count: number | null;
  garage_bay_count: number | null;
  lot_size_sf: number | null;
  finish_level: FinishLevel | null;
  construction_type: ConstructionType | null;
  site_characteristics: Record<string, unknown>;
  complexity_factors: Record<string, unknown>;
  region_jurisdiction: Record<string, unknown>;
  characteristics_enrichment_source: Record<string, unknown> | null;
}

const FINISH_LEVELS: Array<{ value: FinishLevel; label: string }> = [
  { value: "production", label: "Production" },
  { value: "semi_custom", label: "Semi-custom" },
  { value: "custom", label: "Custom" },
  { value: "luxury", label: "Luxury" },
  { value: "ultra_luxury", label: "Ultra-luxury" },
];

const CONSTRUCTION_TYPES: Array<{ value: ConstructionType; label: string }> = [
  { value: "wood_frame", label: "Wood frame" },
  { value: "cmu", label: "CMU" },
  { value: "cmu_wood_hybrid", label: "CMU / wood hybrid" },
  { value: "timber_frame", label: "Timber frame" },
  { value: "icf", label: "ICF" },
  { value: "steel_frame", label: "Steel frame" },
];

interface Props {
  jobId: string;
  /** Start collapsed to avoid cluttering the job edit page. */
  defaultOpen?: boolean;
}

export default function HomeCharacteristicsPanel({ jobId, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [data, setData] = useState<HomeCharacteristics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/home-characteristics`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Status ${res.status}`);
      }
      const json = await res.json();
      setData(json.job as HomeCharacteristics);
    } catch (err) {
      toast.error(`Load failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (open && !data && !loading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const update = useCallback(
    <K extends keyof HomeCharacteristics>(key: K, value: HomeCharacteristics[K]) => {
      setData((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    []
  );

  const save = useCallback(async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/home-characteristics`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heated_sf: data.heated_sf,
          total_sf: data.total_sf,
          bedroom_count: data.bedroom_count,
          bathroom_count: data.bathroom_count,
          half_bathroom_count: data.half_bathroom_count,
          story_count: data.story_count,
          garage_bay_count: data.garage_bay_count,
          lot_size_sf: data.lot_size_sf,
          finish_level: data.finish_level,
          construction_type: data.construction_type,
          site_characteristics: data.site_characteristics ?? {},
          complexity_factors: data.complexity_factors ?? {},
          region_jurisdiction: data.region_jurisdiction ?? {},
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Status ${res.status}`);
      }
      toast.success("Home characteristics saved");
      await load();
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
    }
  }, [data, jobId, load]);

  // Derived: count how many fields are populated
  const populatedCount = data
    ? [
        data.heated_sf,
        data.total_sf,
        data.bedroom_count,
        data.bathroom_count,
        data.half_bathroom_count,
        data.story_count,
        data.garage_bay_count,
        data.lot_size_sf,
        data.finish_level,
        data.construction_type,
      ].filter((v) => v != null).length
    : 0;

  return (
    <section className="border border-[var(--border-default)] bg-[var(--bg-card)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[var(--bg-subtle)] transition-colors"
      >
        <div>
          <NwEyebrow tone="accent">Home characteristics</NwEyebrow>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Optional — enables comp filtering (SF, bedroom count, finish level) across
            cost-intelligence queries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <NwBadge variant={populatedCount > 0 ? "success" : "neutral"} size="sm">
            {populatedCount} / 10 fields
          </NwBadge>
          <span
            className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {open ? "Close" : "Open"}
          </span>
        </div>
      </button>

      {open ? (
        <div className="px-5 pb-5 border-t border-[var(--border-default)]">
          {loading || !data ? (
            <p className="py-6 text-[13px] text-[var(--text-tertiary)]">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <IntField
                  label="Heated SF"
                  value={data.heated_sf}
                  onChange={(v) => update("heated_sf", v)}
                />
                <IntField
                  label="Total SF"
                  value={data.total_sf}
                  onChange={(v) => update("total_sf", v)}
                />
                <IntField
                  label="Lot size SF"
                  value={data.lot_size_sf}
                  onChange={(v) => update("lot_size_sf", v)}
                />
                <IntField
                  label="Bedrooms"
                  value={data.bedroom_count}
                  onChange={(v) => update("bedroom_count", v)}
                />
                <NumField
                  label="Full baths"
                  value={data.bathroom_count}
                  onChange={(v) => update("bathroom_count", v)}
                  step={0.5}
                />
                <IntField
                  label="Half baths"
                  value={data.half_bathroom_count}
                  onChange={(v) => update("half_bathroom_count", v)}
                />
                <IntField
                  label="Stories"
                  value={data.story_count}
                  onChange={(v) => update("story_count", v)}
                />
                <IntField
                  label="Garage bays"
                  value={data.garage_bay_count}
                  onChange={(v) => update("garage_bay_count", v)}
                />
                <Field label="Finish level">
                  <select
                    value={data.finish_level ?? ""}
                    onChange={(e) =>
                      update(
                        "finish_level",
                        e.target.value === "" ? null : (e.target.value as FinishLevel)
                      )
                    }
                    className="w-full px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
                  >
                    <option value="">—</option>
                    {FINISH_LEVELS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Construction type">
                  <select
                    value={data.construction_type ?? ""}
                    onChange={(e) =>
                      update(
                        "construction_type",
                        e.target.value === "" ? null : (e.target.value as ConstructionType)
                      )
                    }
                    className="w-full px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
                  >
                    <option value="">—</option>
                    {CONSTRUCTION_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {data.characteristics_enrichment_source &&
              Object.keys(data.characteristics_enrichment_source).length > 0 ? (
                <div className="mt-4 p-3 border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[11px] text-[var(--text-tertiary)]">
                  <div
                    className="uppercase tracking-[0.14em]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    Last manual update
                  </div>
                  <div className="mt-1">
                    {(data.characteristics_enrichment_source.last_manual_update_at as string) ??
                      "never"}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-end gap-2">
                <NwButton variant="primary" size="md" onClick={save} loading={saving}>
                  Save characteristics
                </NwButton>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="block text-[10px] uppercase tracking-[0.14em] mb-1 text-[var(--text-tertiary)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function IntField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Math.round(Number(e.target.value)))}
        className="w-full px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
      />
    </Field>
  );
}

function NumField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        step={step ?? 1}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-full px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
      />
    </Field>
  );
}
