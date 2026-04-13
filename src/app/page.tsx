"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function Home() {
  const [status, setStatus] = useState<"loading" | "connected" | "error">("loading");
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    async function checkConnection() {
      try {
        const { error } = await supabase.from("cost_codes").select("id").limit(1);
        setStatus(error ? "error" : "connected");

        // Get queue count
        const { count } = await supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .in("status", ["pm_review", "ai_processed"])
          .is("deleted_at", null);
        setQueueCount(count ?? 0);
      } catch {
        setStatus("error");
      }
    }
    checkConnection();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">
          Ross Command Center
        </h1>
        <p className="mt-3 text-gray-400 text-lg">
          Ross Built Custom Homes
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              status === "loading"
                ? "bg-yellow-400 animate-pulse"
                : status === "connected"
                  ? "bg-green-400"
                  : "bg-red-400"
            }`}
          />
          <span className="text-sm text-gray-500">
            {status === "loading"
              ? "Connecting to Supabase..."
              : status === "connected"
                ? "Supabase connected"
                : "Supabase connection failed"}
          </span>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/invoices/upload"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            Upload Invoices
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/invoices/queue"
            className="inline-flex items-center gap-2 px-6 py-3 border border-gray-700 hover:border-gray-500 text-gray-300 font-medium rounded-lg transition-colors"
          >
            Invoice Queue
            {queueCount > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {queueCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
