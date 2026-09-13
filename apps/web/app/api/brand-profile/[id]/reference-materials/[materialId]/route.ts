import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@shared/lib/supabase/server";
import { getSupabaseOwner } from "@shared/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; materialId: string }> }) {
  const { id, materialId } = await params;
  const owner = await getSupabaseOwner(req);
  const sb = getSupabaseServer();
  if (!owner || !sb) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const { data } = await sb.from("reference_materials").select("storage_url").eq("id", materialId).eq("brand_profile_id", id).eq("user_email", owner).maybeSingle();
  const url = data?.storage_url as string | undefined;
  const marker = "/storage/v1/object/public/reference-materials/";
  const path = url?.split(marker)[1];
  if (path) await sb.storage.from("reference-materials").remove([path]);
  const { error } = await sb.from("reference_materials").delete().eq("id", materialId).eq("brand_profile_id", id).eq("user_email", owner);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
