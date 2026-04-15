import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { ADMIN_OR_OWNER, requireRole } from "@/lib/org/require";

export const dynamic = "force-dynamic";

const ACCEPTED = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function extFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  return "png";
}

export const POST = withApiError(async (request: NextRequest) => {
  const membership = await requireRole(ADMIN_OR_OWNER);
  const supabase = createServerClient();

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new ApiError("No file supplied", 400);
  if (!ACCEPTED.has(file.type)) {
    throw new ApiError(`Unsupported file type: ${file.type}`, 400);
  }
  if (file.size > MAX_BYTES) {
    throw new ApiError("Logo exceeds 2 MB limit", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extFor(file.type);
  // Use a stable filename so it overwrites previous uploads cleanly.
  const path = `${membership.org_id}/logo.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("logos")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: "3600",
    });
  if (uploadErr) throw new ApiError(`Upload failed: ${uploadErr.message}`, 500);

  const { data: publicUrl } = supabase.storage.from("logos").getPublicUrl(path);
  // Cache-bust so the nav picks up the new logo immediately.
  const logoUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;

  const { error: updateErr } = await supabase
    .from("organizations")
    .update({ logo_url: logoUrl })
    .eq("id", membership.org_id);
  if (updateErr) throw new ApiError(updateErr.message, 500);

  return NextResponse.json({ logo_url: logoUrl });
});
