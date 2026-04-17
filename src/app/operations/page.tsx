import NavBar from "@/components/nav-bar";
import Breadcrumbs from "@/components/breadcrumbs";

export default function OperationsPage() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs items={[{ label: "Operations" }]} />
        <div className="mb-6">
          <h1 className="font-display text-2xl text-cream">Operations</h1>
          <p className="text-sm text-cream-dim mt-1">
            Scheduling, site activity, and PM workload tools.
          </p>
        </div>

        <div className="bg-brand-card border border-brand-border p-8 text-center">
          <p className="text-sm text-cream-dim">
            Operations features are coming in a future release. This section will
            include scheduling, daily logs, site documentation, and PM workload views.
          </p>
        </div>
      </main>
    </div>
  );
}
