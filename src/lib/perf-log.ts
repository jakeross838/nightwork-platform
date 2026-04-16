/**
 * Per-request query profiler. Wrap any Supabase (or other) promise to log
 * its duration to stdout when it settles. Disabled in prod unless
 * PERF_LOG=1 — the goal is to use this during targeted profiling runs, not
 * in every production request.
 *
 * Format: `[perf] <tag> ${label}: ${ms}ms (rows=${n}, inLoop=${yes|no})`
 */

type QueryResult<T> = { data: T[] | null } | { count: number | null } | { data: T[] | null; count: number | null };

const ENABLED = process.env.PERF_LOG === "1";

// Supabase query builders are thenable but not actual Promises, so we accept
// any PromiseLike. `Promise.resolve(...)` normalizes either into a real
// awaited value.
export async function timed<T>(
  tag: string,
  label: string,
  inLoop: boolean,
  promise: PromiseLike<T>
): Promise<T> {
  if (!ENABLED) return Promise.resolve(promise);
  const t0 = Date.now();
  const result = await promise;
  const ms = Date.now() - t0;

  // Count rows if the result looks like a Supabase query builder result.
  let rows = "-";
  const r = result as unknown as QueryResult<unknown>;
  if (r && typeof r === "object") {
    if ("data" in r && Array.isArray((r as { data: unknown[] }).data)) {
      rows = String((r as { data: unknown[] }).data.length);
    } else if ("count" in r && typeof (r as { count: number | null }).count === "number") {
      rows = `count=${(r as { count: number }).count}`;
    }
  }

  console.log(
    `[perf] ${tag} ${label}: ${ms}ms (rows=${rows}, inLoop=${inLoop ? "yes" : "no"})`
  );
  return result;
}
