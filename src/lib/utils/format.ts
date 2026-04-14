export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatDollars(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format date string or Date to "Apr 13, 2026" */
export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d.includes("T") ? d : d + "T00:00:00") : d;
  if (isNaN(dt.getTime())) return "—";
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

/** Format datetime to "Apr 13, 2026 at 2:45 PM" */
export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "—";
  const time = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()} at ${time}`;
}

export function confidenceColor(score: number): string {
  if (score >= 0.85) return "bg-green-500/20 text-green-400 border-green-500/30";
  if (score >= 0.7) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

export function confidenceLabel(score: number): string {
  if (score >= 0.85) return "High Confidence";
  if (score >= 0.7) return "Needs Review";
  return "Low Confidence";
}

export function daysAgo(dateStr: string): number {
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Format invoice type enum to display string */
export function formatInvoiceType(type: string | null | undefined): string {
  if (!type) return "—";
  const map: Record<string, string> = {
    lump_sum: "Lump Sum",
    progress: "Progress",
    time_and_materials: "Time and Materials",
  };
  return map[type] ?? titleCase(type);
}

/** Format status enum to display string */
export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    received: "Received",
    ai_processed: "AI Processed",
    pm_review: "PM Review",
    pm_approved: "PM Approved",
    pm_held: "PM Held",
    pm_denied: "PM Denied",
    qa_review: "QA Review",
    qa_approved: "QA Approved",
    qa_kicked_back: "QA Kicked Back",
    info_requested: "Info Requested",
    pushed_to_qb: "Pushed to QB",
    qb_failed: "QB Failed",
    in_draw: "In Draw",
    paid: "Paid",
    void: "Void",
  };
  return map[status] ?? titleCase(status);
}

/** Format flag string to display */
export function formatFlag(flag: string): string {
  const map: Record<string, string> = {
    no_invoice_number: "No Invoice Number",
    handwritten_detected: "Handwritten Detected",
    math_mismatch: "Math Mismatch",
    blurry_or_low_quality: "Blurry / Low Quality",
    multi_page: "Multi-Page",
    credit_memo: "Credit Memo",
    not_an_invoice: "Not an Invoice",
  };
  return map[flag] ?? titleCase(flag);
}

/** Format document type */
export function formatDocumentType(type: string): string {
  const map: Record<string, string> = {
    invoice: "Invoice",
    proposal: "Proposal",
    quote: "Quote",
    credit_memo: "Credit Memo",
    statement: "Statement",
    unknown: "Unknown",
  };
  return map[type] ?? titleCase(type);
}

/** Convert snake_case or lowercase to Title Case */
function titleCase(str: string): string {
  return str
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
