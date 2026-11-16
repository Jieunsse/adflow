// ADR-024 Product 개별 조작 — 단계 4 에서 Spring 으로 재배선.
// 백엔드가 upsert 라 PUT 과 POST 의 몸통이 같다. 외부 계약(FormData)은 동결이다.

import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@shared/lib/backend/call";
import { toPublicUrl, toStoragePath } from "@shared/lib/backend/files";
import { type ProductRow, deleteProductImage, putProductImage } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> },
) {
  const { id, productId } = await params;

  const form = await req.formData();
  const raw = form.get("data");
  if (typeof raw !== "string") return NextResponse.json({ error: "data required" }, { status: 400 });

  const entry = JSON.parse(raw) as Omit<ProductRow, "id" | "brandProfileId">;
  let imagePath = toStoragePath(entry.imageUrl);

  const image = form.get("image");
  if (image instanceof File) {
    const uploaded = await putProductImage(req, id, productId, image);
    if (uploaded.error) return uploaded.error;
    if (uploaded.path) imagePath = uploaded.path;
  }

  const row: ProductRow = {
    ...entry,
    id: productId,
    brandProfileId: id,
    imageUrl: imagePath,
  };

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> },
) {
  const { id, productId } = await params;

  // 항목을 지우기 전에 경로를 읽어야 한다 — 지운 뒤엔 어느 파일이었는지 알 길이 없다.
  await deleteProductImage(req, id, productId);

  const del = await callBackend(req, `/stores/products?id=${encodeURIComponent(productId)}`, {
    method: "DELETE",
  });
  if (!del.ok) return NextResponse.json({ error: del.message }, { status: del.status });

  return NextResponse.json({ ok: true });
}
