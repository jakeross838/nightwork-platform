import type { SupabaseClient } from "@supabase/supabase-js";

export interface JobCandidate {
  id: string;
  name: string;
  address: string | null;
  client_name: string | null;
  pm_id: string | null;
}

/** Fields extracted from a parsed invoice that the matcher can search. */
export interface InvoiceSignals {
  job_reference_raw?: string | null;
  po_reference_raw?: string | null;
  vendor_name_raw?: string | null;
  description?: string | null;
  filename?: string | null;
}

export interface MatchResult {
  job: JobCandidate;
  score: number;
  reasons: string[];
  ambiguous: boolean;
  runnersUp: { job: JobCandidate; score: number; reasons: string[] }[];
}

/**
 * Load non-deleted jobs, with the fields the matcher needs.
 */
export async function loadJobCandidates(
  supabase: SupabaseClient
): Promise<JobCandidate[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, name, address, client_name, pm_id")
    .is("deleted_at", null);
  if (error) throw new Error(`Failed to load jobs: ${error.message}`);
  return (data ?? []) as JobCandidate[];
}

/** Strip placeholders/parentheticals so "Dream Island (full address TBD)" → "Dream Island". */
function cleanAddress(addr: string): string {
  return addr
    .replace(/\([^)]*\)/g, "")
    .replace(/\btbd\b/gi, "")
    .trim();
}

/** Surname heuristic: take the last word and strip punctuation. */
function lastWord(s: string): string | null {
  const parts = s
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((w) => w.replace(/[^\w]/g, ""));
  if (parts.length === 0) return null;
  return parts[parts.length - 1];
}

/** First meaningful word from job.name (e.g. "Clark Residence" → "Clark"). */
function primaryNameToken(name: string): string | null {
  const w = name.trim().split(/\s+/)[0];
  return w ? w : null;
}

/**
 * Extract a street key like "501 74th" or "109 seagrape" from a full
 * address, or return the whole head for non-numbered addresses like
 * "dream island". Returns null if the address is just a placeholder.
 */
function streetKey(addr: string): string | null {
  const cleaned = cleanAddress(addr);
  if (!cleaned) return null;
  const head = cleaned.split(",")[0].trim();
  if (!head || head.toLowerCase() === "tbd") return null;

  const words = head.split(/\s+/);
  if (/^\d+$/.test(words[0])) {
    // "501 74th St" → "501 74th" (number + next token is plenty)
    return words.slice(0, 2).join(" ");
  }
  // "Dream Island" → "Dream Island"
  return words.slice(0, Math.min(words.length, 3)).join(" ");
}

interface JobKeys {
  jobKey: string; // always lowercase
  surnameKey: string | null;
  streetKey: string | null;
}

function buildKeys(job: JobCandidate): JobKeys {
  const jobKey = (primaryNameToken(job.name) ?? job.name).toLowerCase();
  const surname = job.client_name ? lastWord(job.client_name) : null;
  const surnameKey = surname ? surname.toLowerCase() : null;
  const streetRaw = job.address ? streetKey(job.address) : null;
  return {
    jobKey,
    surnameKey: surnameKey && surnameKey !== jobKey ? surnameKey : null,
    streetKey: streetRaw ? streetRaw.toLowerCase() : null,
  };
}

/** Normalize a signal for matching: lowercase, collapse underscores/dashes to spaces. */
function normalizeSignal(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Score a single job against the invoice signals. Higher = better.
 *
 * Weights:
 *   job.name token in job_reference / filename   → 3 (strongest signal)
 *   job.name token in vendor / description / po  → 2
 *   surname token in any signal                  → 2
 *   street key in any signal                     → 3
 *
 * Returns a score plus the human-readable reasons that produced it.
 */
function scoreJob(job: JobCandidate, signals: InvoiceSignals): { score: number; reasons: string[] } {
  const keys = buildKeys(job);
  const jobRef = normalizeSignal(signals.job_reference_raw);
  const poRef = normalizeSignal(signals.po_reference_raw);
  const vendor = normalizeSignal(signals.vendor_name_raw);
  const desc = normalizeSignal(signals.description);
  const filename = normalizeSignal(signals.filename);

  let score = 0;
  const reasons: string[] = [];

  const seenReason = new Set<string>();
  const addReason = (r: string, points: number) => {
    if (seenReason.has(r)) return;
    seenReason.add(r);
    score += points;
    reasons.push(r);
  };

  const hit = (haystack: string, key: string): boolean =>
    key.length > 0 && haystack.length > 0 && haystack.includes(key);

  // Job name token (e.g. "drummond", "clark")
  if (keys.jobKey) {
    if (hit(jobRef, keys.jobKey)) addReason(`job name "${keys.jobKey}" in job_reference`, 3);
    if (hit(filename, keys.jobKey)) addReason(`job name "${keys.jobKey}" in filename`, 3);
    if (hit(vendor, keys.jobKey)) addReason(`job name "${keys.jobKey}" in vendor`, 2);
    if (hit(desc, keys.jobKey)) addReason(`job name "${keys.jobKey}" in description`, 2);
    if (hit(poRef, keys.jobKey)) addReason(`job name "${keys.jobKey}" in po_reference`, 2);
  }

  // Client surname
  if (keys.surnameKey) {
    if (hit(jobRef, keys.surnameKey)) addReason(`client surname "${keys.surnameKey}" in job_reference`, 2);
    if (hit(filename, keys.surnameKey)) addReason(`client surname "${keys.surnameKey}" in filename`, 2);
    if (hit(desc, keys.surnameKey)) addReason(`client surname "${keys.surnameKey}" in description`, 2);
    if (hit(poRef, keys.surnameKey)) addReason(`client surname "${keys.surnameKey}" in po_reference`, 2);
  }

  // Street key (number + street name)
  if (keys.streetKey) {
    const normalizedKey = keys.streetKey;
    if (hit(jobRef, normalizedKey)) addReason(`address "${normalizedKey}" in job_reference`, 3);
    if (hit(filename, normalizedKey)) addReason(`address "${normalizedKey}" in filename`, 3);
    if (hit(desc, normalizedKey)) addReason(`address "${normalizedKey}" in description`, 2);
    if (hit(poRef, normalizedKey)) addReason(`address "${normalizedKey}" in po_reference`, 2);
  }

  return { score, reasons };
}

/**
 * Match an invoice to the best-fitting job. If two jobs tie, flag as
 * ambiguous so the PM can resolve (we still return the first).
 *
 * Returns null if no job scored above zero.
 */
export function matchJobForInvoice(
  jobs: JobCandidate[],
  signals: InvoiceSignals
): MatchResult | null {
  const scored = jobs
    .map((job) => {
      const { score, reasons } = scoreJob(job, signals);
      return { job, score, reasons };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  const best = scored[0];
  const runnersUp = scored.slice(1);
  const ambiguous =
    runnersUp.length > 0 && runnersUp[0].score === best.score;

  return {
    job: best.job,
    score: best.score,
    reasons: best.reasons,
    ambiguous,
    runnersUp,
  };
}

/** ============================================================
 *  Overhead detection
 *  ============================================================
 *  Invoices that are company overhead (software subscriptions, storage
 *  rental, utilities, office supplies) should be tagged so PMs can
 *  distinguish them from missed-job-match items in the queue.
 */

// Lowercased vendor name substrings.
const OVERHEAD_VENDOR_PATTERNS = [
  // Software / SaaS
  "anthropic",
  "openai",
  "google",
  "microsoft",
  "adobe",
  "github",
  "gitlab",
  "slack",
  "zoom",
  "dropbox",
  "notion",
  "atlassian",
  "jira",
  "confluence",
  "figma",
  "intuit",
  "quickbooks",
  "xero",
  "stripe",
  // Storage / logistics
  "cubesmart",
  "public storage",
  "extra space",
  "u-haul",
  // Utilities / telecom
  "fpl",
  "florida power",
  "duke energy",
  "spectrum",
  "comcast",
  "xfinity",
  "verizon",
  "at&t",
  "t-mobile",
  // Office
  "staples",
  "office depot",
  "costco",
];

// Lowercased description substrings.
const OVERHEAD_DESCRIPTION_PATTERNS = [
  "subscription",
  "software license",
  "saas",
  "monthly plan",
  "storage rental",
  "storage unit",
  "unit rental",
  "internet service",
  "phone service",
  "cell phone",
  "mobile service",
  "office supplies",
  "utility bill",
];

export interface OverheadCheckResult {
  isOverhead: boolean;
  reason?: string;
}

/**
 * Flag as overhead if the vendor or description matches a known
 * overhead pattern AND we don't have a job reference. Invoices with
 * a clear job reference are assumed to be job-cost even if the vendor
 * is on the overhead list (e.g. an Anthropic-branded project purchase).
 */
export function detectOverhead(signals: InvoiceSignals): OverheadCheckResult {
  const vendor = normalizeSignal(signals.vendor_name_raw);
  const desc = normalizeSignal(signals.description);
  const hasJobRef =
    (signals.job_reference_raw ?? "").trim().length > 0 ||
    (signals.po_reference_raw ?? "").trim().length > 0;

  if (hasJobRef) return { isOverhead: false };

  for (const pattern of OVERHEAD_VENDOR_PATTERNS) {
    if (vendor.includes(pattern)) {
      return { isOverhead: true, reason: `vendor matches overhead pattern "${pattern}"` };
    }
  }
  for (const pattern of OVERHEAD_DESCRIPTION_PATTERNS) {
    if (desc.includes(pattern)) {
      return { isOverhead: true, reason: `description matches overhead pattern "${pattern}"` };
    }
  }
  return { isOverhead: false };
}
