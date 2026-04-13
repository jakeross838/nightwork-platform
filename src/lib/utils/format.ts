export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatDollars(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function confidenceColor(score: number): string {
  if (score >= 0.85) return "bg-green-500/20 text-green-400 border-green-500/30";
  if (score >= 0.7) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

export function confidenceLabel(score: number): string {
  if (score >= 0.85) return "High Confidence";
  if (score >= 0.7) return "Needs Review";
  return "Low Confidence";
}

export function daysAgo(dateStr: string): number {
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
