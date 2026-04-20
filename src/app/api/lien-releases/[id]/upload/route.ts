import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const ACCEPTED = new Set(["application/pdf", "image/png", "image/jpeg", "image/jpg"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function extFor(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  return "bin";
}

/**
 * POST /api/lien-releases/[id]/upload
 *
 * Phase 8f Part F: upload a signed lien release document for a release row.
 * Stored in bucket `lien-release-files` at:
 *   {org_id}/lien-releases/{job_id}/{draw_id}/{vendor_id}.{ext}
 *
 * On success: sets lien_releases.document_url to the public URL, and (if the
 * release is still pending) flips status to received with received_at
 * stamped.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = createServerClient();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file supplied" }, { status: 400 });
    }
    if (!ACCEPTED.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 400 });
    }

    const { data: release, error: fetchErr } = await supabase
      .from("lien_releases")
      .select("id, org_id, job_id, draw_id, vendor_id, status, document_url")
      .eq("id", params.id)
      .eq("org_id", membership.org_id)
      .single();
    if (fetchErr || !release) {
      return NextResponse.json({ error: "Lien release not found" }, { status: 404 });
    }

    const orgId = release.org_id as string | null;
    if (!orgId) {
      return NextResponse.json(
        { error: "Lien release record missing org_id" },
        { status: 500 }
      );
    }
    const jobId = release.job_id as string;
    const drawId = (release.draw_id as string | null) ?? "no-draw";
    const vendorId = (release.vendor_id as string | null) ?? "no-vendor";
    const ext = extFor(file.type);
    const path = `${orgId}/lien-releases/${jobId}/${drawId}/${vendorId}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await supabase.storage
      .from("lien-release-files")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
        cacheControl: "3600",
      });
    if (uploadErr) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    const { data: pub } = supabase.storage.from("lien-release-files").getPublicUrl(path);
    // Cache-bust so a re-uploaded file isn't served from CDN cache.
    const documentUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const updates: Record<string, unknown> = { document_url: documentUrl };
    // Auto-flip to received the first time a doc is uploaded for a pending
    // release. Don't overwrite a 'waived' or 'not_required' flag.
    if (release.status === "pending") {
      updates.status = "received";
      updates.received_at = new Date().toISOString();
    }
    const { error: updateErr } = await supabase
      .from("lien_releases")
      .update(updates)
      .eq("id", params.id);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await logActivity({
      org_id: orgId,
      entity_type: "draw",
      entity_id: drawId !== "no-draw" ? drawId : null,
      action: "updated",
      details: {
        lien_release_document_uploaded: {
          lien_release_id: params.id,
          path,
          status_after: updates.status ?? release.status,
          previously_uploaded: !!release.document_url,
        },
      },
    });

    return NextResponse.json({ ok: true, document_url: documentUrl, status: updates.status ?? release.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
