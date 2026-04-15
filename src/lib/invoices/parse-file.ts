import mammoth from "mammoth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedInvoice } from "@/lib/types/invoice";
import {
  parseInvoiceWithVision,
  parseInvoiceFromText,
  type ParseMeta,
} from "@/lib/claude/parse-invoice";

export type FileKind = "pdf" | "image" | "docx" | "xlsx";

export const ACCEPTED_MIME_TYPES: Record<string, FileKind> = {
  "application/pdf": "pdf",
  "image/jpeg": "image",
  "image/png": "image",
  "image/jpg": "image",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export function fileKindFromExtension(name: string): FileKind | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png"].includes(ext)) return "image";
  if (ext === "docx") return "docx";
  if (ext === "xlsx") return "xlsx";
  return null;
}

export function mimeTypeForImageExtension(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "image/png";
}

/**
 * Route a file buffer through the correct Claude call based on its type.
 * Shared by the /api/invoices/parse route and the bulk-import script.
 */
export async function parseInvoiceFile(args: {
  buffer: Buffer;
  mediaType: string;
  fileKind: FileKind;
  fileName: string;
  supabase: SupabaseClient;
  meta: ParseMeta;
}): Promise<ParsedInvoice> {
  const { buffer, mediaType, fileKind, fileName, supabase, meta } = args;

  if (fileKind === "pdf" || fileKind === "image") {
    return parseInvoiceWithVision(buffer, mediaType, fileName, supabase, meta);
  }

  if (fileKind === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    if (!result.value.trim()) {
      throw new Error("Could not extract text from DOCX file");
    }
    return parseInvoiceFromText(result.value, fileName, supabase, meta);
  }

  throw new Error(`Unsupported file kind: ${fileKind}`);
}
