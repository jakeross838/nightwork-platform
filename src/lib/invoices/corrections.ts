import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fields we track for parser correction capture.
 * Maps the DB column name to where the original parser value lives in ai_raw_response.
 */
const TRACKED_FIELDS: Record<
  string,
  {
    /** Path into ai_raw_response to get the original value */
    aiPath: string;
    /** Path into confidence_details for the field's confidence */
    confidencePath: string;
    /** How to coerce the DB value to a comparable string */
    coerce?: "cents_to_dollars" | "uuid_to_code";
  }
> = {
  vendor_name_raw: {
    aiPath: "vendor_name",
    confidencePath: "vendor_name",
  },
  invoice_number: {
    aiPath: "invoice_number",
    confidencePath: "invoice_number",
  },
  invoice_date: {
    aiPath: "invoice_date",
    confidencePath: "invoice_date",
  },
  total_amount: {
    aiPath: "total_amount",
    confidencePath: "total_amount",
    coerce: "cents_to_dollars",
  },
  cost_code_id: {
    aiPath: "cost_code_suggestion.code",
    confidencePath: "cost_code_suggestion",
    coerce: "uuid_to_code",
  },
  description: {
    aiPath: "description",
    confidencePath: "vendor_name", // no specific confidence — use overall
  },
  document_type: {
    aiPath: "document_type",
    confidencePath: "vendor_name",
  },
  is_change_order: {
    aiPath: "is_change_order",
    confidencePath: "vendor_name",
  },
};

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function stringify(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val ? "true" : "false";
  return String(val);
}

interface CorrectionRow {
  invoice_id: string;
  org_id: string;
  field_name: string;
  original_value: string | null;
  corrected_value: string | null;
  original_confidence: number | null;
  vendor_name: string | null;
  cost_code_id: string | null;
  corrected_by: string;
}

/**
 * Compare the incoming update against the invoice's original parser output
 * and return correction rows for every changed field.
 */
export async function captureCorrections(
  supabase: SupabaseClient,
  invoiceId: string,
  updates: Record<string, unknown>,
  userId: string
): Promise<void> {
  // Load the current invoice with parser originals
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, org_id, vendor_name_raw, invoice_number, invoice_date, total_amount, " +
      "cost_code_id, description, document_type, is_change_order, " +
      "ai_raw_response, confidence_details, confidence_score"
    )
    .eq("id", invoiceId)
    .single();

  if (!invoice) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = invoice as any;
  const aiRaw = (row.ai_raw_response as Record<string, unknown>) ?? {};
  const confDetails = (row.confidence_details as Record<string, unknown>) ?? {};
  const orgId = row.org_id as string;

  // Resolve cost_code_id → code string for comparison
  let newCostCodeStr: string | null = null;
  let newCostCodeId: string | null = null;

  if ("cost_code_id" in updates) {
    newCostCodeId = updates.cost_code_id as string | null;
    if (newCostCodeId) {
      const { data: cc } = await supabase
        .from("cost_codes")
        .select("code")
        .eq("id", newCostCodeId)
        .single();
      newCostCodeStr = (cc?.code as string | null) ?? newCostCodeId;
    }
  }

  const rows: CorrectionRow[] = [];

  for (const [field, config] of Object.entries(TRACKED_FIELDS)) {
    // Only capture if this field is in the update payload
    if (!(field in updates)) continue;

    // Get the original parser value
    const aiOriginal = getNestedValue(aiRaw, config.aiPath);
    const confidence = getNestedValue(confDetails, config.confidencePath);

    // Get the current DB value and the new value
    let currentVal: string | null;
    let newVal: string | null;

    if (field === "total_amount") {
      // DB is cents, AI is dollars
      const aiDollars = aiOriginal != null ? String(aiOriginal) : null;
      const newCents = updates[field] as number | null;
      newVal = newCents != null ? (newCents / 100).toFixed(2) : null;
      // Original value is what the AI said (in dollars)
      currentVal = aiDollars;
    } else if (field === "cost_code_id") {
      // Compare code strings, not UUIDs
      const aiCode = aiOriginal != null ? String(aiOriginal) : null;
      currentVal = aiCode;
      newVal = newCostCodeStr;
    } else {
      currentVal = stringify(aiOriginal);
      newVal = stringify(updates[field]);
    }

    // Skip if new value equals the AI original — no correction happened
    if (currentVal === newVal) continue;
    // Skip if both are null/empty
    if (!currentVal && !newVal) continue;

    rows.push({
      invoice_id: invoiceId,
      org_id: orgId,
      field_name: field,
      original_value: currentVal,
      corrected_value: newVal,
      original_confidence: confidence != null ? Number(confidence) : null,
      vendor_name: (row.vendor_name_raw as string) ?? null,
      cost_code_id: field === "cost_code_id" ? newCostCodeId : (row.cost_code_id as string | null),
      corrected_by: userId,
    });
  }

  if (rows.length === 0) return;

  const { error } = await supabase.from("parser_corrections").insert(rows);
  if (error) {
    // Log but don't fail the invoice save — corrections are observability, not critical path
    console.warn(
      `[corrections] Failed to insert ${rows.length} correction(s) for invoice ${invoiceId}: ${error.message}`
    );
  }
}
