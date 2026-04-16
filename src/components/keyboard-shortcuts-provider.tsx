"use client";

import KeyboardShortcutsModal, { useGlobalShortcuts } from "@/components/keyboard-shortcuts";

export default function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const { showHelp, setShowHelp } = useGlobalShortcuts();
  return (
    <>
      {children}
      <KeyboardShortcutsModal open={showHelp} onClose={() => setShowHelp(false)} />
    </>
  );
}
