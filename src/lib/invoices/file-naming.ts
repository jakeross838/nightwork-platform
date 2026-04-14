import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Format a clean storage filename for an invoice.
 *
 * Pattern: [job]_[vendor]_[invoice#]_[date].[ext]
 *   job      = matched job name, or "Unmatched" / "Overhead"
 *   vendor   = slug of vendor_name_raw (suffixes like LLC/Inc/PBC stripped)
 *   invoice# = invoice_number (preserves alphanumerics + hyphens) or "none"
 *   date     = invoice_date as YYYY-MM-DD, or "no-date"
 *
 * Examples:
 *   Drummond_Doug-Naeher-Drywall_none_2025-12-15.docx
 *   Ruthven_Kimal-Lumber_661779_2026-03-23.pdf
 *   Unmatched_Bobs-Handy-Services_none_2026-03-09.pdf
 *   Overhead_Anthropic_ORFTNCV-8867_2026-02-13.pdf
 *
 * Capped at 200 chars to keep storage paths manageable.
 */
export interface FilenameInputs {
  jobName?: string | null;   // matched job.name or null
  overhead?: boolean;        // true → "Overhead" bucket
  vendorName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null; // ISO date or null
  extension: string;         // without leading dot
}

const MAX_LEN = 200;

/** Strip corporate suffixes so "Doug Naeher Drywall, Inc" → "Doug Naeher Drywall". */
const SUFFIX_RE =
  /\b(l\.?l\.?c\.?|inc\.?|corp\.?|co\.?|ltd\.?|pbc|llp|pllc|pa|pc)\b/gi;

/** Convert a free-text label to the hyphen-joined title-case slug used in filenames. */
export function slugifyPart(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = raw
    .replace(/['"`]/g, "")
    .replace(SUFFIX_RE, "")
    .replace(/[,.]+/g, " ")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      // Preserve all-caps tokens shorter than 4 letters (e.g. "TBD", "AMI")
      w.length <= 3 && w === w.toUpperCase()
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join("-");
}

/** Invoice numbers can have arbitrary punctuation; keep letters, digits, hyphens. */
export function slugifyInvoiceNumber(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = raw
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned;
}

/** Format an invoice date to YYYY-MM-DD, or "no-date" if missing/invalid. */
function formatDatePart(d: string | null | undefined): string {
  if (!d) return "no-date";
  const date = new Date(d.includes("T") ? d : d + "T00:00:00");
  if (isNaN(date.getTime())) return "no-date";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Build the clean filename (without storage folder prefix).
 * Guarantees at most MAX_LEN characters, truncating the vendor token if needed.
 */
export function buildCleanFilename(inputs: FilenameInputs): string {
  const ext = inputs.extension.replace(/^\./, "").toLowerCase() || "bin";

  const job = inputs.overhead
    ? "Overhead"
    : slugifyPart(inputs.jobName) || "Unmatched";
  const vendor = slugifyPart(inputs.vendorName) || "Unknown-Vendor";
  const invoice = slugifyInvoiceNumber(inputs.invoiceNumber) || "none";
  const date = formatDatePart(inputs.invoiceDate);

  let name = `${job}_${vendor}_${invoice}_${date}.${ext}`;
  if (name.length > MAX_LEN) {
    const overflow = name.length - MAX_LEN;
    const truncatedVendor = vendor.slice(0, Math.max(8, vendor.length - overflow));
    name = `${job}_${truncatedVendor}_${invoice}_${date}.${ext}`;
  }
  return name;
}

/** Prefix storage path with the uploads/ folder, matching our bucket convention. */
export function storagePathFor(cleanName: string): string {
  return `uploads/${cleanName}`;
}

/**
 * Pick the file extension from a media type / file kind.
 * Fall back to parsing the original filename if nothing matches.
 */
export function extensionFor(
  mediaType: string | null | undefined,
  fileKind: string | null | undefined,
  fallback: string | null | undefined
): string {
  if (mediaType) {
    if (mediaType === "application/pdf") return "pdf";
    if (mediaType === "image/jpeg" || mediaType === "image/jpg") return "jpg";
    if (mediaType === "image/png") return "png";
    if (mediaType === "image/gif") return "gif";
    if (mediaType === "image/webp") return "webp";
    if (mediaType.includes("wordprocessingml")) return "docx";
    if (mediaType.includes("spreadsheetml")) return "xlsx";
  }
  if (fileKind === "pdf") return "pdf";
  if (fileKind === "docx") return "docx";
  if (fileKind === "xlsx") return "xlsx";
  if (fileKind === "image") return "jpg";
  if (fallback) {
    const m = fallback.match(/\.([a-z0-9]+)$/i);
    if (m) return m[1].toLowerCase();
  }
  return "bin";
}

/**
 * Rename a storage object by copy + delete. Returns the new path.
 *
 * If the target path is already taken, a short 6-char hex suffix is appended
 * before the extension. If source === target, no-ops.
 */
export async function renameStorageObject(
  supabase: SupabaseClient,
  bucket: string,
  sourcePath: string,
  desiredPath: string
): Promise<string> {
  if (sourcePath === desiredPath) return desiredPath;

  const finalPath = await resolveCollisionFreePath(supabase, bucket, desiredPath);

  const { error: moveError } = await supabase.storage
    .from(bucket)
    .move(sourcePath, finalPath);
  if (moveError) {
    // Some storage backends reject move-over-existing even for a fresh path;
    // fall back to copy + remove.
    const { error: copyError } = await supabase.storage
      .from(bucket)
      .copy(sourcePath, finalPath);
    if (copyError) {
      throw new Error(`Storage rename failed: ${copyError.message}`);
    }
    const { error: removeError } = await supabase.storage
      .from(bucket)
      .remove([sourcePath]);
    if (removeError) {
      // Copy succeeded, cleanup failed — log and continue so we don't
      // leave the invoice pointing at a missing file.
      console.warn(`Storage cleanup warning (old object remains): ${removeError.message}`);
    }
  }
  return finalPath;
}

async function resolveCollisionFreePath(
  supabase: SupabaseClient,
  bucket: string,
  desiredPath: string
): Promise<string> {
  const exists = await storageObjectExists(supabase, bucket, desiredPath);
  if (!exists) return desiredPath;
  // Append 6-char hex suffix before extension.
  const dot = desiredPath.lastIndexOf(".");
  const base = dot > 0 ? desiredPath.slice(0, dot) : desiredPath;
  const ext = dot > 0 ? desiredPath.slice(dot) : "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Math.random().toString(16).slice(2, 8);
    const candidate = `${base}-${suffix}${ext}`;
    if (!(await storageObjectExists(supabase, bucket, candidate))) return candidate;
  }
  // Give up and return a timestamp-based name (still unique enough)
  const ts = Date.now();
  return `${base}-${ts}${ext}`;
}

async function storageObjectExists(
  supabase: SupabaseClient,
  bucket: string,
  path: string
): Promise<boolean> {
  // storage.list a single-item folder to probe. Folder of the desired object:
  const lastSlash = path.lastIndexOf("/");
  const folder = lastSlash >= 0 ? path.slice(0, lastSlash) : "";
  const name = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder, { search: name, limit: 100 });
  if (error) return false;
  return (data ?? []).some((obj) => obj.name === name);
}
