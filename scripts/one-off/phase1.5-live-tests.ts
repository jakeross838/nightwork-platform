/**
 * Phase 1.5 R.19 live-test runner.
 *
 * Hits the running dev server at localhost:3000 with real HTTP + a real
 * @supabase/ssr-authenticated cookie jar. No shortcuts — middleware, auth,
 * org scoping, and route handlers all run end-to-end.
 *
 * Steps:
 *   1. Sign in as jake@rossbuilt.com via a map-backed cookie jar so we get
 *      the exact cookie shape @supabase/ssr writes in production.
 *   2. Test 1 — PATCH release-1 status=received  → verify received_at stamps
 *   3. Test 2 — PATCH release-2 status=waived    → verify waived_at stamps
 *   4. Test 3 — PATCH release-3 status=not_required → no extra stamp
 *   5. Test 4 — POST bulk action=waive on releases 4+5 → both get waived_at
 *
 * DB verification happens separately via Supabase MCP; this script focuses on
 * driving the HTTP side cleanly and reporting status codes + response bodies.
 *
 * One-off script — not wired into npm scripts. Run with:
 *   npx tsx scripts/one-off/phase1.5-live-tests.ts
 */
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";

// Load .env.local manually — tsx doesn't auto-load it.
const envText = readFileSync(".env.local", "utf8");
const env: Record<string, string> = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
}

const BASE = "http://localhost:3000";
const EMAIL = "jake@rossbuilt.com";
const PASSWORD = "RossBuilt2026!";

// Fixture IDs (from the earlier Supabase MCP seed).
const RELEASES = {
  receive:          "74c6fbae-ff1b-489e-9c8d-d27b24bdcc99",
  waive:            "2c32177f-5488-4006-9ac2-4c71d4739d25",
  not_required:     "4176d075-5f4c-44a0-ac92-80d3f0fc4ba2",
  bulk_waive_a:     "3232d6c2-65a4-4fe4-b89b-bd5e93c9f5c2",
  bulk_waive_b:     "e24cccda-3d4c-4740-9225-3dec9b72200b",
};

type TestResult = { name: string; ok: boolean; detail: string };

async function main(): Promise<void> {
  // ── Auth: sign in and snapshot the cookie jar ──────────────────────
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
  console.log(`    cookie jar holds ${cookieJar.size} cookie(s)`);

  const cookieHeader = Array.from(cookieJar.entries())
    .map(([n, v]) => `${n}=${v}`)
    .join("; ");

  const results: TestResult[] = [];

  async function callRoute(
    name: string,
    method: "PATCH" | "POST",
    path: string,
    body: unknown
  ): Promise<void> {
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
    const detail = `HTTP ${res.status} — ${text.slice(0, 200)}`;
    console.log(`${ok ? "OK  " : "FAIL"} ${name}: ${detail}`);
    results.push({ name, ok, detail });
  }

  await callRoute(
    "Test 1: PATCH release-1 → received",
    "PATCH",
    `/api/lien-releases/${RELEASES.receive}`,
    { status: "received" }
  );

  await callRoute(
    "Test 2: PATCH release-2 → waived",
    "PATCH",
    `/api/lien-releases/${RELEASES.waive}`,
    { status: "waived" }
  );

  await callRoute(
    "Test 3: PATCH release-3 → not_required",
    "PATCH",
    `/api/lien-releases/${RELEASES.not_required}`,
    { status: "not_required" }
  );

  await callRoute(
    "Test 4: POST bulk action=waive (releases 4+5)",
    "POST",
    `/api/lien-releases/bulk`,
    { ids: [RELEASES.bulk_waive_a, RELEASES.bulk_waive_b], action: "waive" }
  );

  console.log("");
  const failed = results.filter((r) => !r.ok).length;
  if (failed > 0) {
    console.error(`${failed} of ${results.length} live test(s) failed`);
    process.exit(1);
  }
  console.log(`${results.length} live test(s) passed`);
}

main().catch((err) => {
  console.error("unexpected error:", err);
  process.exit(1);
});
