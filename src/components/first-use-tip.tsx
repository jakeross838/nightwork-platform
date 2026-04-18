"use client";

import { useState, useEffect } from "react";

const LS_PREFIX = "nightwork:tip-dismissed:";

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
    <div className="mb-4 border border-stone-blue/30 bg-slate-deep/5 px-4 py-3 flex items-start gap-3">
      <span className="text-stone-blue text-sm mt-0.5 shrink-0">i</span>
      <div className="flex-1 text-sm text-[rgba(59,88,100,0.70)]">{children}</div>
      <button
        type="button"
        onClick={dismiss}
        className="text-xs text-[rgba(59,88,100,0.55)] hover:text-slate-tile shrink-0"
      >
        Dismiss
      </button>
    </div>
  );
}
