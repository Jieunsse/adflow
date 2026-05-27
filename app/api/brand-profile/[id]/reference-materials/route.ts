import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@shared/lib/supabase-server";

const BUCKET = "reference-materials";
const TABLE = "reference_materials";

const ACCEPTED_MIME: Record<string, "image" | "pdf" | "txt"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "application/pdf": "pdf",
  "text/plain": "txt",
};

const MAX_SIZE = 50 * 1024 * 1024; // 50MB (Supabase Storage 기준)

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json([], { status: 200 });

  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("brand_profile_id", id)
    .order("uploaded_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const materials = (data ?? []).map((row) => ({
    id: row.id,
    brandProfileId: row.brand_profile_id,
    name: row.name,
    type: row.type,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storageUrl: row.storage_url,
    uploadedAt: row.uploaded_at,
  }));
  return NextResponse.json(materials);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });

  const type = ACCEPTED_MIME[file.type];
  if (!type) return NextResponse.json({ error: "지원하지 않는 파일 형식이에요" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "파일이 너무 커요 (50MB 이하)" }, { status: 400 });

  const materialId = `ref_${crypto.randomUUID()}`;
  const ext = file.name.split(".").pop() ?? "";
  const storagePath = `${id}/${materialId}${ext ? `.${ext}` : ""}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await sb.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
  const storageUrl = urlData.publicUrl;

  const row = {
    id: materialId,
    brand_profile_id: id,
    name: file.name,
    type,
    mime_type: file.type,
    size_bytes: file.size,
    storage_url: storageUrl,
    uploaded_at: Date.now(),
  };

  const { error: insertError } = await sb.from(TABLE).insert(row);
  if (insertError) {
    await sb.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    id: row.id,
    brandProfileId: row.brand_profile_id,
    name: row.name,
    type: row.type,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storageUrl: row.storage_url,
    uploadedAt: row.uploaded_at,
  });
}
