import type {
  TransactionLineType,
  ProposedItemData,
  ItemType,
  ItemUnit,
  ComponentType,
  ComponentSource,
  PricingModel,
} from "@/lib/cost-intelligence/types";

/**
 * Tab order for the verification queue — maps 1:1 to line_nature values,
 * plus a Review catch-all for lines the AI could not classify. BOM spec
 * lines (line_nature='bom_spec') never appear in main tabs — they render
 * as metadata on the scope line they attach to.
 */
export type QueueTab =
  | "materials"
  | "labor"
  | "scope"
  | "equipment"
  | "services"
  | "review";

export type LineNature =
  | "material"
  | "labor"
  | "scope"
  | "equipment"
  | "service"
  | "bom_spec"
  | "unclassified";

export const NATURE_BY_TAB: Record<
  Exclude<QueueTab, "review">,
  LineNature
> = {
  materials: "material",
  labor: "labor",
  scope: "scope",
  equipment: "equipment",
  services: "service",
};

export interface QueueComponent {
  id: string;
  component_type: ComponentType;
  amount_cents: number;
  source: ComponentSource;
  notes: string | null;
  quantity: number | null;
  unit: string | null;
  unit_rate_cents: number | null;
  display_order: number;
}

export interface QueueLine {
  id: string;
  raw_description: string;
  raw_quantity: number | null;
  raw_unit_text: string | null;
  raw_unit_price_cents: number | null;
  raw_total_cents: number | null;
  match_tier: string | null;
  match_confidence: number | null;
  match_confidence_score: number | null;
  classification_confidence: number | null;
  match_reasoning: string | null;
  created_at: string;
  is_transaction_line: boolean;
  transaction_line_type: TransactionLineType | null;
  proposed_item_id: string | null;
  proposed_item: { id: string; canonical_name: string } | null;
  proposed_item_data: ProposedItemData | null;
  line_tax_cents: number | null;
  overhead_allocated_cents: number | null;
  raw_ocr_text: string | null;
  extraction_id: string;
  proposed_pricing_model: PricingModel | null;
  proposed_scope_size_metric: string | null;
  extracted_scope_size_value: number | null;
  extracted_scope_size_confidence: number | null;
  extracted_scope_size_source: string | null;
  line_nature: LineNature | null;
  scope_split_into_components: boolean;
  scope_estimated_material_cents: number | null;
  invoice: {
    id: string;
    invoice_number: string | null;
    invoice_date: string | null;
    vendor_id: string | null;
    vendor_name: string | null;
    original_file_url: string | null;
    signed_pdf_url: string | null;
  } | null;
  components: QueueComponent[];
}

export interface ClassificationDraft {
  mode: "new" | "existing";
  existing_item_id: string | null;
  canonical_name: string;
  item_type: ItemType;
  unit: ItemUnit;
  category: string;
  subcategory: string;
  specs_json: string;
  pricing_model: PricingModel;
  scope_size_metric: string;
  scope_size_value: string;
  scope_size_source: string | null;
  scope_size_confidence: number | null;
  scope_allow_component_split: boolean;
}

export const COMMON_SCOPE_METRICS = [
  "roof_sf",
  "heated_sf",
  "total_sf",
  "tile_sf",
  "stucco_sf",
  "drywall_sf",
  "paint_sf",
  "lf",
  "each",
  "job",
];

export interface ComponentDraft {
  temp_id: string;
  existing_id: string | null;
  component_type: ComponentType;
  amount_cents: number;
  source: ComponentSource;
  notes: string;
  quantity: number | null;
  unit: string;
  unit_rate_cents: number | null;
}

export const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  material: "Material",
  fabrication: "Fabrication",
  installation: "Installation",
  labor: "Labor",
  equipment_rental: "Equipment rental",
  delivery: "Delivery",
  fuel_surcharge: "Fuel surcharge",
  handling: "Handling",
  restocking: "Restocking",
  tax: "Tax",
  waste_disposal: "Waste disposal",
  permit_fee: "Permit fee",
  bundled: "Bundled",
  labor_and_material: "Labor & material",
  other: "Other",
};

export const COMPONENT_SOURCE_LABELS: Record<ComponentSource, string> = {
  invoice_explicit: "INVOICE",
  ai_extracted: "AI",
  human_added: "MANUAL",
  default_bundled: "DEFAULT",
};
