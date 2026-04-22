/**
 * Branch 1 Final Exit Gate — rollup regression runner (R.19).
 *
 * Exercises the full draw lifecycle end-to-end against a running dev server:
 *
 *   1. POST /api/draws/{id}/action  action=submit    → status submitted
 *      • auto-generates lien_releases per unique vendor
 *      • flips qa_approved invoices → in_draw
 *   2. PATCH /api/lien-releases/{id}  status=waived  → waived_at stamps (Phase 1.5)
 *   3. POST /api/draws/{id}/action  action=approve   → status approved
 *   4. POST /api/draws/{id}/action  action=lock      → status locked
 *   5. POST /api/draws/{id}/action  action=mark_paid → status paid
 *
 * Verifies every Phase 1.1–1.5 behavior holds end-to-end in one continuous
 * flow, not just isolated tests:
 *
 *   • Phase 1.1 enum alignment — all intermediate statuses come from the
 *     canonical sets (no pending_approval, no executed, invoice enum includes
 *     info_requested).
 *   • Phase 1.2 PO role check — verified via static test in
 *     __tests__/po-patch-role-check.test.ts (covered by `npm test`). Not
 *     exercised here; covering the PATCH live would add no signal beyond
 *     what the static test already locks.
 *   • Phase 1.3 atomic RPCs — submit and approve go through
 *     draw_submit_rpc / draw_approve_rpc (single-transaction cascades).
 *   • Phase 1.4 created_by — auto-generated lien_releases inherit created_by
 *     from the draw (written inside the RPC).
 *   • Phase 1.5 waived_at — step 2 exercises the single-PATCH waive stamp.
 *
 * Fixture IDs are injected from the Supabase MCP seed that ran before this
 * script. DB verification is delegated to MCP queries after the HTTP flow
 * completes; this script focuses on driving the HTTP side cleanly.
 *
 * Run: npx tsx scripts/one-off/branch1-rollup-live-tests.ts
 */
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";

const envText = readFileSync(".env.local", "utf8");
const env: Record<string, string> = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const BASE = "http://localhost:3000";
const EMAIL = "jake@rossbuilt.com";
const PASSWORD = "RossBuilt2026!";

// Fixture IDs from the seed.
const FIXT = {
  draw_id: "aaa86ac3-7491-48e3-9da4-b919cafa4d85",
  invoice_ids: [
    "70112a98-9dce-4ef9-b6d2-850a195850f6",
    "74a0fc91-035e-413e-9351-ffbb72d7ffc8",
  ],
};

type TestResult = { name: string; ok: boolean; detail: string };

async function main(): Promise<void> {
  const cookieJar = new Map<string, string>();
  const supa = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll() {
        return Array.from(cookieJar.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(toSet) {
        for (const { name, value } of toSet) cookieJar.set(name, value);
      },
    },
  });

  const { data: authData, error: authErr } = await supa.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (authErr || !authData.session) {
    console.error("FAIL: sign in:", authErr?.message ?? "no session returned");
    process.exit(1);
  }
  console.log(`OK sign-in as ${EMAIL} (uid=${authData.user?.id})`);

  const cookieHeader = Array.from(cookieJar.entries())
    .map(([n, v]) => `${n}=${v}`)
    .join("; ");
  const results: TestResult[] = [];

  async function call(
    name: string,
    method: "PATCH" | "POST",
    path: string,
    body: unknown
  ): Promise<unknown> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const ok = res.status === 200;
    const detail = `HTTP ${res.status} — ${text.slice(0, 300)}`;
    console.log(`${ok ? "OK  " : "FAIL"} ${name}: ${detail}`);
    results.push({ name, ok, detail });
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  // Step 1 — submit
  await call(
    "Step 1: POST draws/action=submit",
    "POST",
    `/api/draws/${FIXT.draw_id}/action`,
    { action: "submit" }
  );

  // After submit, the submit RPC auto-generated lien_releases. We need to
  // discover them via Supabase before the PATCH waive. Using the same auth
  // session (no service-role bypass).
  const { data: liens } = await supa
    .from("lien_releases")
    .select("id, vendor_id, status")
    .eq("draw_id", FIXT.draw_id);
  console.log(
    `    discovered ${liens?.length ?? 0} auto-generated lien release(s)`
  );
  if (!liens || liens.length === 0) {
    console.error(
      "FAIL: no lien_releases auto-generated — submit cascade broken?"
    );
    results.push({
      name: "discover auto-generated liens",
      ok: false,
      detail: "none found",
    });
  } else {
    results.push({
      name: "discover auto-generated liens",
      ok: true,
      detail: `found ${liens.length}`,
    });
  }

  // Step 2 — waive each lien via single PATCH route (Phase 1.5 stamp path)
  for (const lr of liens ?? []) {
    await call(
      `Step 2: PATCH lien ${lr.id.slice(0, 8)} status=waived`,
      "PATCH",
      `/api/lien-releases/${lr.id}`,
      { status: "waived" }
    );
  }

  // Step 3 — approve
  await call(
    "Step 3: POST draws/action=approve",
    "POST",
    `/api/draws/${FIXT.draw_id}/action`,
    { action: "approve" }
  );

  // Step 4 — lock
  await call(
    "Step 4: POST draws/action=lock",
    "POST",
    `/api/draws/${FIXT.draw_id}/action`,
    { action: "lock" }
  );

  // Step 5 — mark_paid
  await call(
    "Step 5: POST draws/action=mark_paid",
    "POST",
    `/api/draws/${FIXT.draw_id}/action`,
    { action: "mark_paid" }
  );

  console.log("");
  const failed = results.filter((r) => !r.ok).length;
  if (failed > 0) {
    console.error(`${failed} of ${results.length} live test step(s) failed`);
    process.exit(1);
  }
  console.log(`${results.length} live test step(s) passed`);
}

main().catch((err) => {
  console.error("unexpected error:", err);
  process.exit(1);
});
