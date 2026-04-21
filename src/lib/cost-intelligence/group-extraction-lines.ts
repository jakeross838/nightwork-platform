/**
 * Group pending extraction lines by (vendor_id + proposed item fingerprint).
 *
 * Lines that share a proposed_item_id, or normalize to the same ai_new_item
 * canonical phrase, are grouped together so the PM can review + classify the
 * whole set in one action (Phase 5's bulk-approve endpoint).
 *
 * Groups ≥ 2 lines; singletons pass through via `singles`.
 */

export interface GroupableLine {
  id: string;
  raw_description: string;
  match_tier: string | null;
  proposed_item_id: string | null;
  proposed_item: { id: string; canonical_name: string } | null;
  proposed_item_data: {
    canonical_name?: string;
    item_type?: string;
    unit?: string;
    specs?: Record<string, unknown> | null;
  } | null;
  invoice: {
    id: string;
    vendor_id: string | null;
    vendor_name: string | null;
  } | null;
  raw_total_cents: number | null;
  raw_unit_price_cents: number | null;
  raw_unit_text: string | null;
  raw_quantity: number | null;
}

export interface LineGroup<T extends GroupableLine = GroupableLine> {
  key: string;
  vendor_id: string | null;
  vendor_name: string | null;
  fingerprint_name: string;
  lines: T[];
  occurrence_count: number;
  total_across_occurrences: number;
  unit_price_range: { min: number; max: number } | null;
  unit: string | null;
}

export interface GroupingResult<T extends GroupableLine = GroupableLine> {
  groups: LineGroup<T>[];
  singles: T[];
}

/**
 * Normalize a canonical name so variable suffixes ("3rd Draw",
 * "SLAB COUNT-5TH", "Bath-12", room labels) collapse into a single
 * fingerprint. Conservative — only strips patterns we've actually seen on
 * Ross Built invoices.
 */
export function normalizeFingerprint(raw: string): string {
  if (!raw) return "";
  let s = raw.toLowerCase().trim();

  // "- slab count-5th", "- slab count 5th", etc.
  s = s.replace(/\bslab\s*count[-\s]?\d+(st|nd|rd|th)?\b/g, "");
  // "-5th", " - 5th" at the end
  s = s.replace(/[-\s]*\d+(st|nd|rd|th)\b\s*$/g, "");
  // "3rd draw", "1st draw", "second draw"
  s = s.replace(/\b(\d+(st|nd|rd|th)|first|second|third|fourth|fifth)\s+draw\b/g, "");
  // "bath-123", "bath 123"
  s = s.replace(/\bbath[-\s]?\d+\b/g, "");
  // "room-xxx", "room xxx"
  s = s.replace(/\broom[-\s]?[a-z0-9]+\b/g, "");
  // "lot-123" / "lot 123"
  s = s.replace(/\blot[-\s]?\d+\b/g, "");
  // collapse punctuation leftovers
  s = s.replace(/[-–—]+/g, " ");
  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

function fingerprintFor(line: GroupableLine): {
  key: string;
  display: string;
  unit: string | null;
} {
  const vendorId = line.invoice?.vendor_id ?? "no-vendor";

  // Existing-item match: fingerprint by item_id.
  const existingItemId = line.proposed_item_id ?? line.proposed_item?.id ?? null;
  if (existingItemId) {
    const display =
      line.proposed_item?.canonical_name ??
      line.proposed_item_data?.canonical_name ??
      line.raw_description;
    return {
      key: `${vendorId}::item::${existingItemId}`,
      display,
      unit: line.proposed_item_data?.unit ?? line.raw_unit_text ?? null,
    };
  }

  // ai_new_item: fingerprint by normalized canonical_name + item_type + unit.
  const canonical =
    line.proposed_item_data?.canonical_name ?? line.raw_description ?? "";
  const itemType = line.proposed_item_data?.item_type ?? "other";
  const unit = line.proposed_item_data?.unit ?? line.raw_unit_text ?? "each";
  const normalized = normalizeFingerprint(canonical);
  return {
    key: `${vendorId}::new::${itemType}::${unit}::${normalized}`,
    display: canonical,
    unit,
  };
}

export function groupExtractionLines<T extends GroupableLine>(
  lines: T[]
): GroupingResult<T> {
  const buckets = new Map<string, { info: ReturnType<typeof fingerprintFor>; lines: T[] }>();

  for (const line of lines) {
    const info = fingerprintFor(line);
    const bucket = buckets.get(info.key);
    if (bucket) {
      bucket.lines.push(line);
    } else {
      buckets.set(info.key, { info, lines: [line] });
    }
  }

  const groups: LineGroup<T>[] = [];
  const singles: T[] = [];

  const bucketValues = Array.from(buckets.values());
  for (const { info, lines: bucketLines } of bucketValues) {
    if (bucketLines.length < 2) {
      singles.push(...bucketLines);
      continue;
    }

    const total = bucketLines.reduce(
      (s: number, l: T) => s + (l.raw_total_cents ?? 0),
      0
    );
    const unitPrices = bucketLines
      .map((l: T) => l.raw_unit_price_cents)
      .filter((v: number | null): v is number => typeof v === "number" && Number.isFinite(v));

    const unitPriceRange =
      unitPrices.length > 0
        ? { min: Math.min(...unitPrices), max: Math.max(...unitPrices) }
        : null;

    const first = bucketLines[0];
    groups.push({
      key: info.key,
      vendor_id: first.invoice?.vendor_id ?? null,
      vendor_name: first.invoice?.vendor_name ?? null,
      fingerprint_name: info.display,
      lines: bucketLines,
      occurrence_count: bucketLines.length,
      total_across_occurrences: total,
      unit_price_range: unitPriceRange,
      unit: info.unit,
    });
  }

  // Sort groups by total descending (biggest spend first)
  groups.sort((a, b) => b.total_across_occurrences - a.total_across_occurrences);

  return { groups, singles };
}
