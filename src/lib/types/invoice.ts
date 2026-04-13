export interface ParsedLineItem {
  description: string;
  date: string | null;
  qty: number | null;
  unit: string | null;
  rate: number | null;
  amount: number;
}

export interface ConfidenceDetails {
  vendor_name: number;
  invoice_number: number;
  total_amount: number;
  job_reference: number;
  cost_code_suggestion: number;
  [key: string]: number;
}

export interface CostCodeSuggestion {
  code: string;
  description: string;
  confidence: number;
  is_change_order: boolean;
}

export interface ParsedInvoice {
  vendor_name: string;
  vendor_address: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  po_reference: string | null;
  job_reference: string | null;
  description: string;
  invoice_type: "progress" | "time_and_materials" | "lump_sum";
  co_reference: string | null;
  line_items: ParsedLineItem[];
  subtotal: number;
  tax: number | null;
  total_amount: number;
  confidence_score: number;
  confidence_details: ConfidenceDetails;
  flags: string[];
  cost_code_suggestion?: CostCodeSuggestion;
}

export interface ParseResult {
  parsed: ParsedInvoice;
  file_url: string;
  file_name: string;
  file_type: string;
}
