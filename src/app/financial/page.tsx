import NavBar from "@/components/nav-bar";
import Breadcrumbs from "@/components/breadcrumbs";

export default function FinancialPage() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs items={[{ label: "Financial" }]} />
        <div className="mb-6">
          <h1 className="font-display text-2xl text-cream">Financial</h1>
          <p className="text-sm text-cream-dim mt-1">
            Invoices, draws, payments, aging, and lien releases — all in one place.
          </p>
        </div>

        <div className="bg-brand-card border border-brand-border p-8 text-center">
          <p className="text-sm text-cream-dim">
            The consolidated financial view is coming in Phase 2 of the nav reorg.
            In the meantime, use the existing routes:
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <PlaceholderLink href="/invoices" label="All Invoices" />
            <PlaceholderLink href="/invoices/queue" label="PM Queue" />
            <PlaceholderLink href="/invoices/qa" label="Accounting QA" />
            <PlaceholderLink href="/invoices/upload" label="Upload Invoice" />
            <PlaceholderLink href="/invoices/payments" label="Payments" />
            <PlaceholderLink href="/draws" label="Draws" />
            <PlaceholderLink href="/vendors" label="Vendors" />
          </div>
        </div>
      </main>
    </div>
  );
}

function PlaceholderLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="px-4 py-2 border border-brand-border text-sm text-cream hover:bg-brand-surface transition-colors"
    >
      {label}
    </a>
  );
}
