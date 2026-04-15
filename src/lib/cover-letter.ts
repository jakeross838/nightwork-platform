/**
 * Phase 8f — Draw cover letter generator.
 *
 * Builds the cover-letter body for a given draw, applying the org-level
 * template if set or falling back to a built-in default. Placeholders are
 * substituted with formatted values.
 */

import { formatCents, formatDate } from "@/lib/utils/format";

export const DEFAULT_COVER_LETTER_TEMPLATE = `RE: {{job_name}} — Draw #{{draw_number}}, Period {{period_start}} to {{period_end}}

Please find enclosed Application and Certificate for Payment (AIA G702) and Continuation Sheet (G703) for the above-referenced project.

Current Payment Due: {{current_payment_due}}
Contract Sum to Date: {{contract_sum_to_date}}
Total Completed & Stored to Date: {{total_completed}} ({{percent_complete}}%)
Retainage: {{retainage}}

Supporting documentation including all vendor invoices and lien releases are attached.`;

export interface CoverLetterContext {
  job_name: string;
  job_address: string;
  owner_name: string;
  draw_number: number;
  period_start: string | null;
  period_end: string | null;
  current_payment_due: number;
  contract_sum_to_date: number;
  total_completed: number;
  percent_complete: number;
  retainage: number;
}

export function renderCoverLetter(
  template: string | null,
  ctx: CoverLetterContext
): string {
  const body = template && template.trim().length > 0 ? template : DEFAULT_COVER_LETTER_TEMPLATE;
  const substitutions: Record<string, string> = {
    job_name: ctx.job_name || "—",
    job_address: ctx.job_address || "—",
    owner_name: ctx.owner_name || "—",
    draw_number: String(ctx.draw_number),
    period_start: formatDate(ctx.period_start) || "—",
    period_end: formatDate(ctx.period_end) || "—",
    current_payment_due: formatCents(ctx.current_payment_due),
    contract_sum_to_date: formatCents(ctx.contract_sum_to_date),
    total_completed: formatCents(ctx.total_completed),
    percent_complete: ctx.percent_complete.toFixed(1),
    retainage: formatCents(ctx.retainage),
  };
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => substitutions[key] ?? `{{${key}}}`);
}
