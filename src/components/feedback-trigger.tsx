"use client";

import { useState } from "react";
import FeedbackModal from "./feedback-modal";

/**
 * Thin trigger that owns the modal state so it can be dropped into the
 * nav bar (or anywhere else). The button itself renders minimally — the
 * host styles it via CSS class overrides if needed.
 */
export default function FeedbackTrigger({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        aria-label="Give feedback"
      >
        {children ?? "Give feedback"}
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
