"use client";

import { useState, useEffect } from "react";

const LS_PREFIX = "commandpost:tip-dismissed:";

export default function FirstUseTip({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(LS_PREFIX + id);
    if (!dismissed) setVisible(true);
  }, [id]);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(LS_PREFIX + id, "1");
    setVisible(false);
  }

  return (
    <div className="mb-4 border border-teal/30 bg-teal/5 px-4 py-3 flex items-start gap-3">
      <span className="text-teal text-sm mt-0.5 shrink-0">i</span>
      <div className="flex-1 text-sm text-cream-muted">{children}</div>
      <button
        type="button"
        onClick={dismiss}
        className="text-xs text-cream-dim hover:text-cream shrink-0"
      >
        Dismiss
      </button>
    </div>
  );
}
