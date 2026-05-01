// Re-exports for the design-system playground fixtures (Stage 1.5a T19.5).
//
// Pure constants only. No imports from @/lib/supabase|org|auth (per
// SPEC C6 / D9). Consumers can do:
//
//   import { SAMPLE_INVOICES, SAMPLE_VENDORS } from '@/app/design-system/_fixtures';
//
// instead of reaching into individual files.

export * from "./cost-codes";
export * from "./vendors";
export * from "./jobs";
export * from "./users";
export * from "./invoices";
export * from "./draws";
export * from "./change-orders";
