import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function storage() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set to upload documents.");
  client ??= createClient(url, key, { auth: { persistSession: false } });
  return client.storage.from(process.env.SUPABASE_DOCUMENTS_BUCKET ?? "case-documents");
}

export const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
export const MAX_TOTAL_UPLOAD_BYTES = 3.5 * 1024 * 1024;

export async function uploadCaseDocument(caseId: string, file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const path = `${caseId}/${randomUUID()}.${ext}`;
  const { error } = await storage().upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { path, sha256, size: bytes.length };
}

export async function removeObjects(paths: string[]) {
  if (paths.length) await storage().remove(paths);
}

/** Short-lived link for the owner to open a private document. */
export async function signedDocumentUrl(path: string, seconds = 300) {
  const { data, error } = await storage().createSignedUrl(path, seconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
