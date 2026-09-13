import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@shared/lib/supabase/server";
import { getSupabaseOwner } from "@shared/lib/supabase/auth";

const BUCKET = "product-images";

export type ProductRow = {
  id: string; brandProfileId: string; name: string; description: string;
  imageUrl?: string; price?: string; targetUrl?: string; createdAt: number;
};

export function expose(row: ProductRow): ProductRow { return row; }

export async function putProductImage(req: NextRequest, brandProfileId: string, productId: string, image: File): Promise<{ path?: string; error?: NextResponse }> {
  const sb = getSupabaseServer();
  if (!sb || !(await getSupabaseOwner(req))) return { error: NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 }) };
  const ext = (image.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${brandProfileId}/${productId}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, await image.arrayBuffer(), { contentType: image.type, upsert: true });
  if (error) return {};
  return { path: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

export async function deleteProductImage(req: NextRequest, brandProfileId: string, productId: string): Promise<void> {
  const sb = getSupabaseServer();
  const owner = await getSupabaseOwner(req);
  if (!sb || !owner) return;
  const { data } = await sb.from("products").select("image_url").eq("id", productId).eq("brand_profile_id", brandProfileId).eq("user_email", owner).maybeSingle();
  const imageUrl = data?.image_url as string | null | undefined;
  const marker = "/storage/v1/object/public/product-images/";
  const path = imageUrl?.split(marker)[1];
  if (path) await sb.storage.from(BUCKET).remove([path]);
}
