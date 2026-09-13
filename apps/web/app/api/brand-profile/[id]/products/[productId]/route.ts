import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@shared/lib/supabase/server";
import { getSupabaseOwner } from "@shared/lib/supabase/auth";
import { deleteProductImage, putProductImage, type ProductRow } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; productId: string }> }) {
  const { id, productId } = await params;
  const owner = await getSupabaseOwner(req);
  const sb = getSupabaseServer();
  if (!owner || !sb) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const form = await req.formData();
  const raw = form.get("data");
  if (typeof raw !== "string") return NextResponse.json({ error: "data가 필요해요." }, { status: 400 });
  const entry = JSON.parse(raw) as ProductRow;
  let imageUrl = entry.imageUrl;
  const image = form.get("image");
  if (image instanceof File) {
    const uploaded = await putProductImage(req, id, productId, image);
    if (uploaded.error) return uploaded.error;
    imageUrl = uploaded.path ?? imageUrl;
  }
  const row = { id: productId, user_email: owner, brand_profile_id: id, name: entry.name, description: entry.description, image_url: imageUrl ?? null, price: entry.price ?? null, target_url: entry.targetUrl ?? null, created_at: entry.createdAt };
  const { error } = await sb.from("products").upsert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...entry, id: productId, brandProfileId: id, imageUrl });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; productId: string }> }) {
  const { id, productId } = await params;
  const owner = await getSupabaseOwner(req);
  const sb = getSupabaseServer();
  if (!owner || !sb) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  await deleteProductImage(req, id, productId);
  const { error } = await sb.from("products").delete().eq("id", productId).eq("brand_profile_id", id).eq("user_email", owner);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
