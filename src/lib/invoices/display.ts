/**
 * Shared display-name helpers for invoices.
 */

export type FileKind = "pdf" | "docx" | "image" | "xlsx" | "unknown";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

/** Infer file kind from the storage URL extension. Handles signed URLs
 *  where a `?token=...` query string follows the filename. */
export function fileKindFromUrl(url: string | null | undefined): FileKind {
  if (!url) return "unknown";
  // Strip query string and fragment, then pull the extension.
  const withoutQuery = url.split("?")[0].split("#")[0];
  const lastSegment = withoutQuery.split("/").pop() ?? "";
  const dotIdx = lastSegment.lastIndexOf(".");
  const ext = dotIdx >= 0 ? lastSegment.slice(dotIdx + 1).toLowerCase() : "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  if (IMAGE_EXTS.has(ext)) return "image";
  return "unknown";
}

/** Fall back in this order when constructing a display name. */
export function invoiceDisplayName(inv: {
  vendor_name_raw?: string | null;
  invoice_number?: string | null;
  jobs?: { name: string | null } | null;
}): string {
  const vendor = (inv.vendor_name_raw ?? "").trim() || "Unknown vendor";
  if (inv.invoice_number && inv.invoice_number.trim()) {
    return `${vendor} — Inv #${inv.invoice_number.trim()}`;
  }
  const jobName = inv.jobs?.name?.trim();
  if (jobName) return `${vendor} — ${jobName}`;
  return vendor;
}
