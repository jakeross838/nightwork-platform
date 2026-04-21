/**
 * Cost Intelligence Spine — shared TypeScript types.
 *
 * Matches migration 00052. Numeric money fields are cents (BIGINT) on the
 * wire and `number` in TS — stay in cents until you hit the UI layer.
 */

export type ItemType =
  | "material"
  | "labor"
  | "equipment"
  | "service"
  | "subcontract"
  | "other";

export type ItemUnit =
  | "each"
  | "sf"
  | "lf"
  | "sy"
  | "cy"
  | "lb"
  | "gal"
  | "hr"
  | "day"
  | "lump_sum"
  | "pkg"
  | "box";

export type MatchTier =
  | "alias_match"
  | "trigram_match"
  | "ai_semantic_match"
  | "ai_new_item";

export type CreatedVia = MatchTier | "manual";

export type ExtractionStatus = "pending" | "partial" | "verified" | "rejected";

export type LineVerificationStatus =
  | "pending"
  | "verified"
  | "corrected"
  | "rejected"
  | "auto_committed"
  | "not_item";

export type TransactionLineType =
  | "progress_payment"
  | "draw"
  | "rental_period"
  | "service_period"
  | "change_order_narrative"
  | "partial_payment"
  | "zero_dollar_note"
  | "other";

export type SourceType =
  | "invoice"
  | "invoice_line"
  | "po"
  | "po_line"
  | "co"
  | "co_line"
  | "proposal"
  | "quote"
  | "manual_entry";

export interface Item {
  id: string;
  org_id: string;
  canonical_name: string;
  description: string | null;
  item_type: ItemType;
  category: string | null;
  subcategory: string | null;
  specs: Record<string, unknown>;
  unit: ItemUnit;
  canonical_unit: string;
  conversion_rules: Record<string, ConversionRule>;
  default_cost_code_id: string | null;
  pricing_model: PricingModel;
  scope_size_metric: string | null;
  first_seen_source: string | null;
  ai_confidence: number | null;
  human_verified: boolean;
  human_verified_at: string | null;
  human_verified_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ConversionRule {
  ratio: number;
  notes?: string;
}

export interface UnitConversionSuggestionRow {
  id: string;
  org_id: string;
  item_id: string;
  from_unit: string;
  to_unit: string;
  suggested_ratio: number;
  ai_reasoning: string | null;
  ai_confidence: number | null;
  source_extraction_line_id: string | null;
  status: "pending" | "confirmed" | "rejected" | "superseded";
  confirmed_by: string | null;
  confirmed_at: string | null;
  confirmed_ratio: number | null;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface ProposedItemData {
  canonical_name: string;
  item_type: ItemType;
  category: string | null;
  subcategory: string | null;
  specs: Record<string, unknown>;
  unit: ItemUnit;
}

export interface InvoiceOverheadEntry {
  type: string;
  amount_cents: number;
  description: string;
  source_line_id?: string;
}

export interface InvoiceExtractionRow {
  id: string;
  org_id: string;
  invoice_id: string;
  raw_ocr_text: string | null;
  raw_pdf_url: string | null;
  extracted_at: string;
  extraction_model: string | null;
  extraction_prompt_version: string | null;
  total_tokens_input: number | null;
  total_tokens_output: number | null;
  field_confidences: Record<string, number>;
  verification_status: ExtractionStatus;
  verified_lines_count: number;
  total_lines_count: number;
  verified_at: string | null;
  verified_by: string | null;
  auto_committed: boolean;
  auto_commit_reason: string | null;
  invoice_subtotal_cents: number | null;
  invoice_tax_cents: number;
  invoice_tax_rate: number | null;
  invoice_overhead: InvoiceOverheadEntry[];
  invoice_total_cents: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type OverheadType =
  | "delivery"
  | "freight"
  | "shipping"
  | "fuel_surcharge"
  | "handling"
  | "restocking"
  | "core_charge";

export interface InvoiceExtractionLineRow {
  id: string;
  org_id: string;
  extraction_id: string;
  invoice_line_item_id: string | null;
  line_order: number;
  raw_description: string;
  raw_quantity: number | null;
  raw_unit_price_cents: number | null;
  raw_total_cents: number | null;
  raw_unit_text: string | null;
  proposed_item_id: string | null;
  proposed_item_data: ProposedItemData | null;
  match_tier: MatchTier | null;
  match_confidence: number | null;
  match_confidence_score: number | null;
  classification_confidence: number | null;
  match_reasoning: string | null;
  candidates_considered: CandidateConsideration[] | null;
  verification_status: LineVerificationStatus;
  verified_item_id: string | null;
  verified_at: string | null;
  verified_by: string | null;
  correction_notes: string | null;
  vendor_item_pricing_id: string | null;
  line_tax_cents: number;
  line_is_taxable: boolean | null;
  overhead_allocated_cents: number;
  landed_total_cents: number | null;
  is_allocated_overhead: boolean;
  overhead_type: OverheadType | null;
  is_transaction_line: boolean;
  transaction_line_type: TransactionLineType | null;
  non_item_reason: string | null;
  proposed_pricing_model: PricingModel | null;
  proposed_scope_size_metric: string | null;
  extracted_scope_size_value: number | null;
  extracted_scope_size_confidence: number | null;
  extracted_scope_size_source: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CandidateConsideration {
  item_id: string;
  canonical_name: string;
  score?: number;
  rejected_reason?: string;
}

export interface VendorItemPricingRow {
  id: string;
  org_id: string;
  vendor_id: string;
  item_id: string;
  unit_price_cents: number;
  quantity: number;
  total_cents: number;
  unit: string;
  tax_cents: number;
  tax_rate: number | null;
  is_taxable: boolean | null;
  overhead_allocated_cents: number;
  landed_total_cents: number | null;
  job_id: string | null;
  cost_code_id: string | null;
  scope_tags: string[] | null;
  source_type: SourceType;
  source_invoice_id: string | null;
  source_invoice_line_id: string | null;
  source_extraction_line_id: string | null;
  source_po_id: string | null;
  source_co_id: string | null;
  source_doc_url: string | null;
  transaction_date: string;
  recorded_at: string;
  ai_confidence: number | null;
  created_via: CreatedVia | null;
  human_verified: boolean;
  human_verified_by: string | null;
  human_verified_at: string | null;
  auto_committed: boolean;
  scope_size_value: number | null;
  scope_size_source: ScopeSizeSource | null;
  scope_size_confidence: number | null;
  scope_size_notes: string | null;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface MatchResult {
  item_id: string | null;
  proposed_item_data: ProposedItemData | null;
  /** Legacy: equal to match_confidence. Kept until all consumers migrate. */
  confidence: number;
  /** How sure the AI is that matched_item_id is correct. 0 when match=new. */
  match_confidence: number;
  /** How sure the AI is about the proposed type/category/specs. Meaningful for every tier. */
  classification_confidence: number;
  created_via: MatchTier;
  reasoning: string;
  candidates_considered: CandidateConsideration[];
  /**
   * Cost component breakdown detected from the raw line text. Empty array means
   * the AI did not find explicit components — the pipeline will synthesize a
   * single default_bundled component matching the line total.
   */
  components: ExtractedComponent[];
  /**
   * Pricing model detection. unit = discrete goods priced per unit; scope =
   * installed/subcontract work compared by total / scope_size_value. When
   * pricing_model === 'scope', scope_size_metric should be set; size_value
   * is optional and only populated if the invoice itself names a size.
   */
  pricing_model: PricingModel;
  scope_size_metric: string | null;
  scope_size_value: number | null;
  scope_size_confidence: number | null;
  scope_size_source: string | null;
}

export type ComponentType =
  | "material"
  | "fabrication"
  | "installation"
  | "labor"
  | "equipment_rental"
  | "delivery"
  | "fuel_surcharge"
  | "handling"
  | "restocking"
  | "tax"
  | "waste_disposal"
  | "permit_fee"
  | "bundled"
  | "labor_and_material"
  | "other";

export type PricingModel = "unit" | "scope";

export type ScopeSizeSource =
  | "invoice_extraction"
  | "manual"
  | "job_characteristics"
  | "daily_log"
  | "plan_ai"
  | "inferred";

export interface ExtractedScopeInfo {
  pricing_model: PricingModel;
  scope_size_metric: string | null;
  scope_size_value: number | null;
  scope_size_confidence: number | null;
  scope_size_source: string | null;
}

export type ComponentSource =
  | "invoice_explicit"
  | "ai_extracted"
  | "human_added"
  | "default_bundled";

export interface ExtractedComponent {
  component_type: ComponentType;
  amount_cents: number;
  source: ComponentSource;
  notes?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unit_rate_cents?: number | null;
}

export interface LineCostComponentRow {
  id: string;
  org_id: string;
  vendor_item_pricing_id: string | null;
  invoice_extraction_line_id: string | null;
  component_type: ComponentType;
  amount_cents: number;
  quantity: number | null;
  unit: string | null;
  unit_rate_cents: number | null;
  source: ComponentSource;
  ai_confidence: number | null;
  notes: string | null;
  display_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const COMPONENT_TYPES: ComponentType[] = [
  "material",
  "fabrication",
  "installation",
  "labor",
  "equipment_rental",
  "delivery",
  "fuel_surcharge",
  "handling",
  "restocking",
  "tax",
  "waste_disposal",
  "permit_fee",
  "bundled",
  "labor_and_material",
  "other",
];

export interface VendorContext {
  vendor_id: string | null;
  vendor_name: string | null;
  /** Recent alias_text strings this vendor has used (for prompt grounding). */
  recent_aliases: Array<{ alias_text: string; canonical_name: string }>;
  /** Past corrections for this vendor — most recent first. */
  recent_corrections: Array<{
    source_text: string;
    ai_canonical_name: string | null;
    corrected_canonical_name: string | null;
  }>;
}

export interface CostIntelligenceSettings {
  auto_commit_enabled: boolean;
  auto_commit_threshold: number;
  verification_required_for_low_confidence: boolean;
}
