import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@shared/lib/supabase-server";

const BUCKET = "product-images";
const TABLE = "products";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const { id, productId } = await params;
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const formData = await req.formData();
  const raw = formData.get("data");
  if (typeof raw !== "string") return NextResponse.json({ error: "data required" }, { status: 400 });

  const entry = JSON.parse(raw) as {
    name: string; description: string;
    price?: string; targetUrl?: string;
    imageUrl?: string;
  };

  let imageUrl = entry.imageUrl ?? null;
  const imageFile = formData.get("image");
  if (imageFile instanceof File) {
    const ext = imageFile.name.split(".").pop() ?? "jpg";
    const path = `${id}/${productId}.${ext}`;
    const buf = await imageFile.arrayBuffer();
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, {
      contentType: imageFile.type, upsert: true,
    });
    if (!upErr) {
      imageUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }
  }

  const { data, error } = await sb
    .from(TABLE)
    .update({
      name: entry.name,
      description: entry.description,
      image_url: imageUrl,
      price: entry.price ?? null,
      target_url: entry.targetUrl ?? null,
    })
    .eq("id", productId)
    .eq("brand_profile_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    id: data.id,
    brandProfileId: data.brand_profile_id,
    name: data.name,
    description: data.description,
    imageUrl: data.image_url ?? undefined,
    price: data.price ?? undefined,
    targetUrl: data.target_url ?? undefined,
    createdAt: data.created_at,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const { id, productId } = await params;
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  // 이미지 파일 삭제 시도 (실패해도 계속)
  await sb.storage.from(BUCKET).remove([`${id}/${productId}.jpg`, `${id}/${productId}.png`, `${id}/${productId}.webp`]);

  const { error } = await sb.from(TABLE).delete().eq("id", productId).eq("brand_profile_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
