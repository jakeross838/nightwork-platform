"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NavBar from "@/components/nav-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import CsvImporter from "@/components/csv-importer";
import { supabase } from "@/lib/supabase/client";

export default function PurchaseOrderImportPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [jobName, setJobName] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/jobs/${params.id}/purchase-orders/import`); return; }
      const { data: j } = await supabase.from("jobs").select("name").eq("id", params.id).single();
      if (j) setJobName(j.name as string);
    }
    load();
  }, [params.id, router]);

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Jobs", href: "/jobs" },
            { label: jobName || "Job", href: `/jobs/${params.id}` },
            { label: "Purchase Orders", href: `/jobs/${params.id}/purchase-orders` },
            { label: "Import" },
          ]}
        />
        <h2 className="font-display text-2xl text-cream mb-3">Import Purchase Orders</h2>
        <p className="text-sm text-cream-dim mb-6">
          Upload a CSV or Excel file with columns for PO number, vendor, description, and amount.
          Unknown vendors will be created automatically. <Link href={`/jobs/${params.id}/purchase-orders`} className="text-teal hover:underline">Back to POs</Link>
        </p>

        <CsvImporter
          fields={[
            { key: "po_number", label: "PO Number", required: true, aliases: ["po_number", "po", "number"] },
            { key: "vendor_name", label: "Vendor Name", aliases: ["vendor_name", "vendor", "supplier"] },
            { key: "description", label: "Description", aliases: ["description", "desc", "scope"] },
            { key: "amount", label: "Amount", required: true, type: "number", aliases: ["amount", "total", "amount_total"] },
            { key: "cost_code", label: "Cost Code", aliases: ["cost_code", "code"] },
            { key: "budget_line", label: "Budget Line", aliases: ["budget_line"] },
            { key: "issued_date", label: "Issued Date", type: "date", aliases: ["issued_date", "date"] },
            { key: "notes", label: "Notes", aliases: ["notes"] },
          ]}
          hint="Required columns: po_number, amount. vendor_name, description, cost_code, issued_date, notes are optional."
          importLabel="Import POs"
          onImport={async (rows) => {
            const res = await fetch(`/api/jobs/${params.id}/po-import`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rows }),
            });
            const data = await res.json();
            if (!res.ok) return { error: data.error || `HTTP ${res.status}` };
            return { imported: data.imported as number };
          }}
        />
      </main>
    </div>
  );
}
