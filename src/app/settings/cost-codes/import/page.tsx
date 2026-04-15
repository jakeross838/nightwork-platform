"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/nav-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import CsvImporter from "@/components/csv-importer";
import { supabase } from "@/lib/supabase/client";

export default function CostCodeImportPage() {
  const router = useRouter();

  useEffect(() => {
    async function ensureAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.replace("/login?redirect=/settings/cost-codes/import");
    }
    ensureAuth();
  }, [router]);

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Settings", href: "/settings" },
            { label: "Cost Codes", href: "/settings/cost-codes" },
            { label: "Import" },
          ]}
        />
        <h2 className="font-display text-2xl text-cream mb-3">Import Cost Codes</h2>
        <p className="text-sm text-cream-dim mb-6">
          Duplicates on code are updated. Missing codes are created.
          <Link href="/settings/cost-codes" className="text-teal hover:underline ml-2">Back to cost codes</Link>
        </p>

        <CsvImporter
          fields={[
            { key: "code", label: "Code", required: true, aliases: ["code"] },
            { key: "description", label: "Description", required: true, aliases: ["description", "desc", "name"] },
            { key: "category", label: "Category", aliases: ["category"] },
            { key: "sort_order", label: "Sort Order", type: "number", aliases: ["sort_order", "sort"] },
          ]}
          hint="Required: code, description. Category and sort order optional."
          importLabel="Import Cost Codes"
          onImport={async (rows) => {
            const codes = rows.map((r) => ({
              code: r.code,
              description: r.description,
              category: r.category || null,
              sort_order: r.sort_order ? parseInt(r.sort_order) : 0,
            }));
            const res = await fetch("/api/cost-codes/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ codes }),
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
