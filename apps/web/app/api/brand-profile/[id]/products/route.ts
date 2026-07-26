// ADR-024 Product — 단계 4 에서 Supabase 직접 접근을 Spring 으로 갈아끼웠다.
// 외부 계약은 동결이다: GET 은 맨 배열, POST 는 FormData(data, image).

import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@shared/lib/backend/call";
import { toPublicUrl, toStoragePath } from "@shared/lib/backend/files";
import { type ProductRow, expose, putProductImage } from "./shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await callBackend(req, `/stores/products?brandProfileId=${encodeURIComponent(id)}`);
  if (!call.ok) return NextResponse.json({ error: call.message }, { status: call.status });
  if (!call.res.ok) {
    return NextResponse.json({ error: "제품을 불러오지 못했어요." }, { status: call.res.status });
  }

  const { items } = (await call.res.json()) as { items: ProductRow[] };
  return NextResponse.json(items.map(expose));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const form = await req.formData();
  const raw = form.get("data");
  if (typeof raw !== "string") return NextResponse.json({ error: "data required" }, { status: 400 });

  const entry = JSON.parse(raw) as ProductRow;
  if (!entry.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // 클라가 조립된 URL 을 되돌려 보낸다 — 저장 경로로 되돌려야 접두사가 겹치지 않는다.
  let imagePath = toStoragePath(entry.imageUrl);

  const image = form.get("image");
  if (image instanceof File) {
    const uploaded = await putProductImage(req, id, entry.id, image);
    if (uploaded.error) return uploaded.error;
    if (uploaded.path) imagePath = uploaded.path;
  }

  const row: ProductRow = { ...entry, brandProfileId: id, imageUrl: imagePath };
  const save = await callBackend(req, "/stores/products", {
    method: "POST",
    body: JSON.stringify({ item: row }),
    contentType: "application/json",
  });
  if (!save.ok) return NextResponse.json({ error: save.message }, { status: save.status });
  if (!save.res.ok) {
    return NextResponse.json({ error: "제품을 저장하지 못했어요." }, { status: save.res.status });
  }

  return NextResponse.json({ ...row, imageUrl: toPublicUrl(imagePath) });
}
