"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import JobTabs from "@/components/job-tabs";
import JobFinancialBar from "@/components/job-financial-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";

export default function JobActivityPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [jobName, setJobName] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/jobs/${params.id}/activity`); return; }
      const { data: j } = await supabase.from("jobs").select("name").eq("id", params.id).single();
      if (j) setJobName(j.name as string);
    }
    load();
  }, [params.id, router]);

  return (
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Jobs", href: "/jobs" },
            { label: jobName || "...", href: `/jobs/${params.id}` },
            { label: "Activity" },
          ]}
        />
        <div className="mb-4">
          <h2 className="font-display text-2xl text-[color:var(--text-primary)]">{jobName || "..."}</h2>
        </div>
        <JobTabs jobId={params.id} active="activity" />
        <JobFinancialBar jobId={params.id} />

        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-8 text-center">
          <p className="text-sm text-[color:var(--text-secondary)]">
            Activity log coming soon. Will show CO approvals, invoice status
            changes, draw submissions, and team notes for this job.
          </p>
        </div>
      </main>
  );
}
