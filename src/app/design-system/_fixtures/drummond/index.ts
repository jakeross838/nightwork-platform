// Re-exports for the design-system Caldwell fixtures (Stage 1.5b).
//
// Pure constants only. No imports from @/lib/supabase|org|auth (per
// hook T10c — nightwork-post-edit.sh:194-230). Consumers can do:
//
//   import { CALDWELL_INVOICES, CALDWELL_VENDORS } from '@/app/design-system/_fixtures/drummond';
//
// instead of reaching into individual files.
//
// Per CONTEXT D-04 — CALDWELL_* prefix vs SAMPLE_* keeps Caldwell
// fixtures separable from playground fictional fixtures during
// cross-imports.

export * from "./types";
export * from "./jobs";
export * from "./vendors";
export * from "./cost-codes";
export * from "./invoices";
export * from "./draws";
export * from "./draw-line-items";
export * from "./change-orders";
export * from "./budget";
export * from "./lien-releases";
export * from "./schedule";
export * from "./payments";
export * from "./reconciliation";
