import AppShell from "@/components/app-shell";
import Breadcrumbs from "@/components/breadcrumbs";

export default function OperationsPage() {
  return (
    <AppShell>
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs items={[{ label: "Operations" }]} />
        <div className="mb-6">
          <h1 className="font-display text-2xl text-slate-tile">Operations</h1>
          <p className="text-sm text-tertiary mt-1">
            Scheduling, site activity, and PM workload tools.
          </p>
        </div>

        <div className="bg-white border border-border-def p-8 text-center">
          <p className="text-sm text-tertiary">
            Operations features are coming in a future release. This section will
            include scheduling, daily logs, site documentation, and PM workload views.
          </p>
        </div>
      </main>
    </AppShell>
  );
}
