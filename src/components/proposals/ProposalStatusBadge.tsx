/**
 * Phase 3.4 Issue 2 — proposal review status badge.
 *
 * Maps proposal-review state to a color/label pill matching the
 * invoice review surface's `statusBadgeOutline()` pattern. Pre-commit
 * proposals only render `awaiting_review`; the post-commit values
 * (`committed`, `rejected`, `converted_to_po`) are wired now so the
 * future committed-proposal view can drop into the same component.
 *
 * The optional `signed` prop appends an informational `· Signed`
 * suffix when the extracted PDF carries an acceptance signature
 * (`accepted_signature_present` true). Visual: middot separator,
 * faded color, no extra structural meaning — just a hint that the
 * vendor has already counter-signed.
 */

export type ProposalReviewStatus =
  | "awaiting_review"
  | "committed"
  | "rejected"
  | "converted_to_po";

interface Props {
  status: ProposalReviewStatus;
  /** Pre-commit only: append " · Signed" when the proposal PDF was already counter-signed by the vendor. */
  signed?: boolean;
}

export default function ProposalStatusBadge({ status, signed }: Props) {
  const { label, classes } = badgeFor(status);
  const showSigned = signed && status === "awaiting_review";
  return (
    <span
      className={`inline-flex items-center text-xs px-3 py-1 font-medium ${classes}`}
    >
      {label}
      {showSigned && (
        <span className="ml-1.5 opacity-70">· Signed</span>
      )}
    </span>
  );
}

function badgeFor(s: ProposalReviewStatus): { label: string; classes: string } {
  switch (s) {
    case "awaiting_review":
      return {
        label: "Awaiting review",
        classes:
          "bg-transparent text-[color:var(--nw-warn)] border border-[var(--nw-warn)]",
      };
    case "committed":
      return {
        label: "Accepted",
        classes:
          "bg-transparent text-[color:var(--nw-success)] border border-[rgba(74,138,111,0.5)]",
      };
    case "rejected":
      return {
        label: "Rejected",
        classes:
          "bg-transparent text-[color:var(--nw-danger)] border border-[rgba(176,85,78,0.5)]",
      };
    case "converted_to_po":
      return {
        label: "Converted to PO",
        classes:
          "bg-transparent text-[color:var(--nw-stone-blue)] border border-[var(--nw-stone-blue)]",
      };
  }
}
