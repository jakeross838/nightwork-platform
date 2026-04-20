"use client";

import CsvImporter from "@/components/csv-importer";
import NwEyebrow from "@/components/nw/Eyebrow";

export default function POImportContent({ jobId }: { jobId: string }) {
  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
      <NwEyebrow tone="muted" className="mb-2">Job · Purchase Orders</NwEyebrow>
      <h2
        className="m-0 mb-3"
        style={{
          fontFamily: "var(--font-space-grotesk)",
          fontWeight: 500,
          fontSize: "30px",
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
        }}
      >
        Import Purchase Orders
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Upload a CSV or Excel file with columns for PO number, vendor, description, and amount.
        Unknown vendors will be created automatically.
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
          const res = await fetch(`/api/jobs/${jobId}/po-import`, {
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
  );
}
