// ADR-023 Reference Material 삭제 — 단계 4 에서 Spring 으로 재배선.
// 외부 계약 동결: 실패해도 204 로 조용히 끝난다(화면은 로컬에서도 지운다).

import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@shared/lib/backend/call";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> },
) {
  const { id, materialId } = await params;

  // 항목을 지우기 전에 경로를 읽어야 한다 — 지운 뒤엔 어느 파일이었는지 알 길이 없다.
  const list = await callBackend(
    req,
    `/stores/reference-materials?brandProfileId=${encodeURIComponent(id)}`,
  );
  if (list.ok && list.res.ok) {
    const { items } = (await list.res.json()) as {
      items: Array<{ id: string; storageUrl: string }>;
    };
    const path = items.find((m) => m.id === materialId)?.storageUrl;
    if (path && !path.startsWith("data:") && !path.startsWith("http")) {
      await callBackend(req, `/files/${path}`, { method: "DELETE" });
    }
  }

  await callBackend(req, `/stores/reference-materials?id=${encodeURIComponent(materialId)}`, {
    method: "DELETE",
  });

  return new NextResponse(null, { status: 204 });
}
