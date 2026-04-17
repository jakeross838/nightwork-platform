# Deferred Findings

Tracking non-blocking issues found during phase work that need
attention later. Each entry links to the phase where it was
discovered.

## F-001: DEFAULT_ORG_ID hardcoded in budget-import route
**Discovered:** Phase A (commit pending)
**File:** src/app/api/jobs/[id]/budget-import/route.ts:62
**Issue:** Route hardcodes org_id = "00000000-0000-0000-0000-000000000001"
instead of reading from authenticated user's organization_memberships.
Budget lines and COs imported via this route all get assigned to
Ross Built's default org UUID regardless of the uploading user's
actual org.
**Impact:** Multi-tenant data leakage. Currently masked because only
Ross Built uses import. Would misassign data if any other org
imports.
**Severity:** High once multi-tenant. Low now.
**Recommended fix:** Read org_id from
organization_memberships WHERE user_id = auth.user.id, error if
no membership. Pattern exists in other routes — grep for
"organization_memberships" to find reference implementations.

## F-002: PostgREST RLS join embedding failures
**Discovered:** Pre-Phase-A (from commit 79ab01d)
**Files:** 6 routes using tryCreateServiceRoleClient() fallback:
- /api/dashboard
- /api/draws/[id]
- /api/draws/[id]/export
- /api/jobs/health
- /api/jobs/[id]/overview
- /api/invoices/[id]
**Issue:** Deep joins under user-session RLS return null for some
rows (e.g. cost_codes embed on budget_lines). Workaround: auth
the user, verify org membership, then use service-role client for
the data query.
**Impact:** Current pattern is safe (auth still enforced), but
masks underlying RLS policy bugs. Any future route with deep joins
needs the same workaround.
**Severity:** Low (workaround is safe). Medium (technical debt).
**Recommended fix:** Audit RLS policies on jobs, invoices,
budget_lines, cost_codes, draws. Likely missing policies for
embedded-read scenarios. Fix policies, then remove service-role
fallback across the 6 routes.
