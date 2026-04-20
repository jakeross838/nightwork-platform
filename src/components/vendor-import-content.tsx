"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Breadcrumbs from "@/components/breadcrumbs";
import CsvImporter from "@/components/csv-importer";
import { supabase } from "@/lib/supabase/client";
import NwEyebrow from "@/components/nw/Eyebrow";

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
        <NwEyebrow tone="muted" className="mb-2">Admin · Import</NwEyebrow>
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
          Import Vendors
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Upload a CSV or Excel file with vendor info. Existing vendors (case-insensitive name match) will be updated; new names become new vendors.
          <Link href="/vendors" className="ml-2 hover:underline" style={{ color: "var(--nw-gulf-blue)" }}>Back to vendors</Link>
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
