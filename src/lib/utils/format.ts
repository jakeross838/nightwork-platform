/**
 * Cents → "$1,234.56" — always 2 decimals, negatives use a minus sign
 * ("-$1,234.56", not parens). Use this everywhere money is rendered.
 */
export function formatCents(cents: number): string {
 if (cents === null || cents === undefined || isNaN(cents)) return "$0.00";
 const abs = Math.abs(cents) / 100;
 const formatted = new Intl.NumberFormat("en-US", {
 style: "currency",
 currency: "USD",
 minimumFractionDigits: 2,
 maximumFractionDigits: 2,
 }).format(abs);
 return cents < 0 ? `-${formatted}` : formatted;
}

/** Dollars → "$1,234.56", null → "—". Same negative-sign rules as formatCents. */
export function formatDollars(amount: number | null): string {
 if (amount === null || amount === undefined || isNaN(amount)) return "—";
 const abs = Math.abs(amount);
 const formatted = new Intl.NumberFormat("en-US", {
 style: "currency",
 currency: "USD",
 minimumFractionDigits: 2,
 maximumFractionDigits: 2,
 }).format(abs);
 return amount < 0 ? `-${formatted}` : formatted;
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
 if (score >= 0.85) return "bg-transparent text-green-700 border border-green-600";
 if (score >= 0.7) return "bg-transparent text-amber-700 border border-amber-600";
 return "bg-transparent text-red-700 border border-red-600";
}

/** Outline-style status badge: transparent bg, 1px solid border, matching text color. */
export function statusBadgeOutline(status: string): string {
 if (["pm_approved", "qa_approved", "pushed_to_qb"].includes(status)) return "bg-transparent text-[color:var(--nw-success)] border border-[rgba(74,138,111,0.5)]";
 if (["in_draw", "paid"].includes(status)) return "bg-transparent text-[color:var(--nw-stone-blue)] border border-[var(--nw-stone-blue)]";
 if (["pm_review", "ai_processed", "qa_review", "received", "info_requested"].includes(status)) return "bg-transparent text-brass border border-brass";
 if (["pm_held"].includes(status)) return "bg-transparent text-brass border border-brass";
 if (["qa_kicked_back", "pm_denied", "void", "qb_failed"].includes(status)) return "bg-transparent text-[color:var(--nw-danger)] border border-[rgba(176,85,78,0.5)]";
 return "bg-transparent text-[color:var(--text-muted)] border border-[var(--border-strong)]";
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

/** Days between any timestamp (ISO or Date) and now. Negative if future. */
export function daysSince(d: string | Date | null | undefined): number {
 if (!d) return 0;
 const dt = typeof d === "string" ? new Date(d) : d;
 if (isNaN(dt.getTime())) return 0;
 return Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24));
}

/** Format a timestamp as a relative phrase — "2 hours ago", "Yesterday", "3 days ago". */
export function formatRelativeTime(d: string | Date | null | undefined): string {
 if (!d) return "—";
 const dt = typeof d === "string" ? new Date(d) : d;
 if (isNaN(dt.getTime())) return "—";
 const diffMs = Date.now() - dt.getTime();
 const sec = Math.floor(diffMs / 1000);
 if (sec < 0) return formatDate(dt);
 if (sec < 60) return "Just now";
 const min = Math.floor(sec / 60);
 if (min < 60) return min === 1 ? "1 minute ago" : `${min} minutes ago`;
 const hr = Math.floor(min / 60);
 if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
 const day = Math.floor(hr / 24);
 if (day === 1) return "Yesterday";
 if (day < 7) return `${day} days ago`;
 if (day < 30) {
   const wk = Math.floor(day / 7);
   return wk === 1 ? "1 week ago" : `${wk} weeks ago`;
 }
 return formatDate(dt);
}

/** Format a percentage with one decimal, e.g. 66.9% — input is 0..100 already. */
export function formatPercent(value: number | null | undefined): string {
 if (value === null || value === undefined || isNaN(value)) return "—";
 return `${value.toFixed(1)}%`;
}

/** Format a 0..1 ratio as a percent, e.g. 0.669 → "66.9%". */
export function formatRatio(value: number | null | undefined): string {
 if (value === null || value === undefined || isNaN(value)) return "—";
 return `${(value * 100).toFixed(1)}%`;
}

/** Alias for formatCents — accepts null/undefined defensively. */
export function formatMoney(cents: number | null | undefined): string {
 if (cents === null || cents === undefined) return "$0.00";
 return formatCents(cents);
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LEGACY_ROLE_LABEL: Record<string, string> = {
 pm: "PM",
 accounting: "Accounting",
 owner: "Owner",
 admin: "Admin",
 system: "System",
 user: "User",
};

/**
 * Render a status_history `who` value. Newer writes store the acting user's
 * UUID so the UI can resolve to their real name via `names`. Legacy entries
 * held a role string ("pm" / "accounting" / "system") and fall back to a
 * title-cased label.
 */
export function formatWho(who: string, names?: Map<string, string>): string {
 if (!who) return "";
 if (UUID_RE.test(who)) {
 return names?.get(who) ?? "User";
 }
 return LEGACY_ROLE_LABEL[who] ?? (who.charAt(0).toUpperCase() + who.slice(1));
}
