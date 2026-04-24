"use client";

export interface PaymentTrackingPanelProps {
  checkNumber: string;
  onCheckNumberChange: (value: string) => void;
  pickedUp: boolean;
  onPickedUpChange: (value: boolean) => void;
  mailedDate: string;
  onMailedDateChange: (value: string) => void;
  saving: boolean;
  onSave: () => void;
}

export default function PaymentTrackingPanel({
  checkNumber,
  onCheckNumberChange,
  pickedUp,
  onPickedUpChange,
  mailedDate,
  onMailedDateChange,
  saving,
  onSave,
}: PaymentTrackingPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Check #</label>
        <input type="text" value={checkNumber} onChange={(e) => onCheckNumberChange(e.target.value)} placeholder="e.g. 10452"
          className="w-full px-3 py-2.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-secondary)] focus:border-[var(--nw-stone-blue)] focus:outline-none transition-colors" />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider">Picked Up</label>
        <button onClick={() => onPickedUpChange(!pickedUp)}
          className={`relative inline-flex h-6 w-11 items-center transition-colors ${pickedUp ? "bg-[var(--nw-success)]" : "bg-[var(--border-default)]"}`}>
          <span className={`inline-block h-4 w-4 transform bg-white transition-transform ${pickedUp ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <span className="text-xs text-[color:var(--text-secondary)]">{pickedUp ? "Yes" : "No"}</span>
      </div>
      {!pickedUp && (
        <div>
          <label className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-1.5 block">Mailed Date</label>
          <input type="date" value={mailedDate} onChange={(e) => onMailedDateChange(e.target.value)}
            className="w-full px-3 py-2.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none transition-colors" />
        </div>
      )}
      <button onClick={onSave} disabled={saving}
        className="w-full px-4 py-2.5 bg-[var(--nw-stone-blue)] hover:bg-[var(--nw-gulf-blue)] text-[color:var(--bg-page)] font-medium transition-colors disabled:opacity-50">
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
