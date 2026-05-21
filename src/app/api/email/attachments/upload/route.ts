// POST /api/email/attachments/upload
// Accepts multipart/form-data with a single "file" field. Streams to Supabase
// Storage under email-attachments/<userId>/<uuid>-<filename>. Returns metadata
// the composer hands back to /api/email/send when the user clicks Send.

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB per file

export interface UploadedAttachment {
  name: string;
  mime: string;
  size: number;
  storage_path: string;
}

function sanitizeFilename(name: string): string {
  // Keep the extension, strip path separators, cap length.
  const base = name
    .replace(/[/\\]+/g, "_")
    .replace(/[^\w.\- ]+/g, "_")
    .trim();
  return base.slice(0, 200) || "file";
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart body" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File exceeds 20MB limit (${file.size} bytes)` },
      { status: 413 },
    );
  }

  const cleanName = sanitizeFilename(file.name || "attachment");
  const storagePath = `${user.id}/${randomUUID()}-${cleanName}`;

  const admin = createAdminClient();
  const arrayBuf = await file.arrayBuffer();

  const { error } = await admin.storage
    .from("email-attachments")
    .upload(storagePath, new Uint8Array(arrayBuf), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    return NextResponse.json(
      { error: `Upload failed: ${error.message}` },
      { status: 500 },
    );
  }

  const meta: UploadedAttachment = {
    name: cleanName,
    mime: file.type || "application/octet-stream",
    size: file.size,
    storage_path: storagePath,
  };

  return NextResponse.json({ data: meta }, { status: 201 });
}
