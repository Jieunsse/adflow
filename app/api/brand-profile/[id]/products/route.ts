import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@shared/lib/supabase-server";

const BUCKET = "product-images";
const TABLE = "products";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json([], { status: 200 });

  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("brand_profile_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    (data ?? []).map(rowToEntry)
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const formData = await req.formData();
  const raw = formData.get("data");
  if (typeof raw !== "string") return NextResponse.json({ error: "data required" }, { status: 400 });

  const entry = JSON.parse(raw) as {
    id: string; name: string; description: string;
    price?: string; targetUrl?: string; createdAt: number;
  };

  let imageUrl: string | undefined;
  const imageFile = formData.get("image");
  if (imageFile instanceof File) {
    const ext = imageFile.name.split(".").pop() ?? "jpg";
    const path = `${id}/${entry.id}.${ext}`;
    const buf = await imageFile.arrayBuffer();
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, {
      contentType: imageFile.type, upsert: true,
    });
    if (!upErr) {
      imageUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }
  }

  const row = {
    id: entry.id,
    brand_profile_id: id,
    name: entry.name,
    description: entry.description,
    image_url: imageUrl ?? null,
    price: entry.price ?? null,
    target_url: entry.targetUrl ?? null,
    created_at: entry.createdAt,
  };

  const { error } = await sb.from(TABLE).insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(rowToEntry(row));
}

function rowToEntry(row: Record<string, unknown>) {
  return {
    id: row.id,
    brandProfileId: row.brand_profile_id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url ?? undefined,
    price: row.price ?? undefined,
    targetUrl: row.target_url ?? undefined,
    createdAt: row.created_at,
  };
}
