"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Breadcrumbs from "@/components/breadcrumbs";
import CsvImporter from "@/components/csv-importer";
import { supabase } from "@/lib/supabase/client";

export default function VendorImportPageContent() {
  const router = useRouter();

  useEffect(() => {
    async function ensureAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.replace("/login?redirect=/vendors");
    }
    ensureAuth();
  }, [router]);

  return (
    <>
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Vendors", href: "/vendors" },
            { label: "Import" },
          ]}
        />
        <h2 className="font-display text-2xl text-cream mb-3">Import Vendors</h2>
        <p className="text-sm text-cream-dim mb-6">
          Upload a CSV or Excel file with vendor info. Existing vendors (case-insensitive name match) will be updated; new names become new vendors.
          <Link href="/vendors" className="text-teal hover:underline ml-2">Back to vendors</Link>
        </p>

        <CsvImporter
          fields={[
            { key: "name", label: "Name", required: true, aliases: ["name", "vendor", "vendor_name"] },
            { key: "email", label: "Email", aliases: ["email"] },
            { key: "phone", label: "Phone", aliases: ["phone", "phone_number"] },
            { key: "address", label: "Address", aliases: ["address"] },
            { key: "category", label: "Trade / Category", aliases: ["category", "trade"] },
            { key: "notes", label: "Notes", aliases: ["notes"] },
          ]}
          hint="Required column: name. Others optional."
          importLabel="Import Vendors"
          onImport={async (rows) => {
            const res = await fetch("/api/vendors/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vendors: rows }),
            });
            const data = await res.json();
            if (!res.ok) return { error: data.error || `HTTP ${res.status}` };
            return { imported: data.imported as number };
          }}
        />
      </main>
    </>
  );
}
