import { redirect } from "next/navigation";

const VIEW_REDIRECTS: Record<string, string> = {
  invoices: "/invoices",
  queue: "/invoices/queue",
  qa: "/invoices/qa",
  payments: "/invoices/payments",
  draws: "/draws",
  aging: "/financials/aging-report",
  liens: "/invoices/liens",
};

export default function FinancialPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const view = searchParams.view ?? "invoices";
  const dest = VIEW_REDIRECTS[view] ?? "/invoices";
  redirect(dest);
}
