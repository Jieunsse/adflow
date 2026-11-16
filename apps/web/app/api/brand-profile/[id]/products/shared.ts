// products 라우트 2개(목록·개별)가 함께 쓰는 조각. server-side only.

import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@shared/lib/backend/call";
import { toPublicUrl } from "@shared/lib/backend/files";

const BUCKET = "product-images";

/** 와이어는 TS ProductEntry 와 같다. imageUrl 만 의미가 다르다 — 서버에선 저장 경로다. */
export type ProductRow = {
  id: string;
  brandProfileId: string;
  name: string;
  description: string;
  imageUrl?: string;
  price?: string;
  targetUrl?: string;
  createdAt: number;
};

/** 저장 경로를 화면이 쓸 URL 로. 목록·저장 응답이 모두 이걸 통과한다. */
export function expose(row: ProductRow): ProductRow {
  return { ...row, imageUrl: toPublicUrl(row.imageUrl) };
}

/**
 * 이미지를 버킷에 올리고 저장 경로를 돌려준다.
 *
 * 업로드가 실패하면 경로를 바꾸지 않는다 — 항목 저장은 계속 진행돼 기존 이미지가 살아남는다.
 * (Supabase 시절의 `if (!upErr)` 동작을 그대로 승계한다.)
 */
export async function putProductImage(
  req: NextRequest,
  brandProfileId: string,
  productId: string,
  image: File,
): Promise<{ path?: string; error?: NextResponse }> {
  const ext = (image.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const call = await callBackend(
    req,
    `/files/${BUCKET}/${brandProfileId}/${productId}.${ext || "jpg"}`,
    { method: "PUT", body: await image.arrayBuffer(), contentType: image.type },
  );

  if (!call.ok) {
    return { error: NextResponse.json({ error: call.message }, { status: call.status }) };
  }
  if (!call.res.ok) return {};

  return { path: ((await call.res.json()) as { path: string }).path };
}

/** 저장된 경로의 파일만 지운다 — 확장자를 추측하지 않는다. */
export async function deleteProductImage(
  req: NextRequest,
  brandProfileId: string,
  productId: string,
): Promise<void> {
  const list = await callBackend(
    req,
    `/stores/products?brandProfileId=${encodeURIComponent(brandProfileId)}`,
  );
  if (!list.ok || !list.res.ok) return;

  const { items } = (await list.res.json()) as { items: ProductRow[] };
  const path = items.find((p) => p.id === productId)?.imageUrl;
  if (!path || path.startsWith("data:") || path.startsWith("http")) return;

  await callBackend(req, `/files/${path}`, { method: "DELETE" });
}
