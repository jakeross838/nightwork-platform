import type {
  TransactionLineType,
  ProposedItemData,
  ItemType,
  ItemUnit,
  ComponentType,
  ComponentSource,
} from "@/lib/cost-intelligence/types";

export type QueueTab =
  | "materials"
  | "labor"
  | "services"
  | "equipment"
  | "flagged"
  | "notes";

export const ITEM_TYPE_BY_TAB: Record<
  Extract<QueueTab, "materials" | "labor" | "services" | "equipment">,
  ItemType
> = {
  materials: "material",
  labor: "labor",
  services: "service",
  equipment: "equipment",
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
  invoice: {
    id: string;
    invoice_number: string | null;
    invoice_date: string | null;
    vendor_id: string | null;
    vendor_name: string | null;
    original_file_url: string | null;
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
}

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
  other: "Other",
};

export const COMPONENT_SOURCE_LABELS: Record<ComponentSource, string> = {
  invoice_explicit: "INVOICE",
  ai_extracted: "AI",
  human_added: "MANUAL",
  default_bundled: "DEFAULT",
};
