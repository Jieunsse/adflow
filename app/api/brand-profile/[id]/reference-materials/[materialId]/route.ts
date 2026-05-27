import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@shared/lib/supabase-server";

const BUCKET = "reference-materials";
const TABLE = "reference_materials";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> },
) {
  const { id, materialId } = await params;
  const sb = getSupabaseServer();
  if (!sb) return new NextResponse(null, { status: 204 });

  const { data } = await sb.from(TABLE).select("storage_url").eq("id", materialId).eq("brand_profile_id", id).single();

  if (data?.storage_url && !data.storage_url.startsWith("data:")) {
    // Supabase Storage URL에서 path 추출
    const url = new URL(data.storage_url);
    const prefix = `/storage/v1/object/public/${BUCKET}/`;
    const storagePath = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : null;
    if (storagePath) await sb.storage.from(BUCKET).remove([storagePath]);
  }

  await sb.from(TABLE).delete().eq("id", materialId).eq("brand_profile_id", id);
  return new NextResponse(null, { status: 204 });
}
