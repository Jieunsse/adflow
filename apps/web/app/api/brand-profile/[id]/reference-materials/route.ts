// ADR-023 Reference Material — 단계 4 에서 Supabase 직접 접근을 Spring 으로 갈아끼웠다.
// 외부 계약은 동결이다: GET 은 맨 배열, POST 는 FormData(file).

import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@shared/lib/backend/call";
import { toPublicUrl } from "@shared/lib/backend/files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "reference-materials";

const ACCEPTED_MIME: Record<string, "image" | "pdf" | "txt"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "application/pdf": "pdf",
  "text/plain": "txt",
};

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

type MaterialRow = {
  id: string;
  brandProfileId: string;
  name: string;
  type: "image" | "pdf" | "txt";
  mimeType: string;
  sizeBytes: number;
  storageUrl: string;
  uploadedAt: number;
};

function expose(row: MaterialRow): MaterialRow {
  return { ...row, storageUrl: toPublicUrl(row.storageUrl) ?? row.storageUrl };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await callBackend(
    req,
    `/stores/reference-materials?brandProfileId=${encodeURIComponent(id)}`,
  );
  if (!call.ok) return NextResponse.json({ error: call.message }, { status: call.status });
  if (!call.res.ok) {
    return NextResponse.json({ error: "참고 자료를 불러오지 못했어요." }, { status: call.res.status });
  }

  const { items } = (await call.res.json()) as { items: MaterialRow[] };
  return NextResponse.json(items.map(expose));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });

  // 신뢰 경계의 입력 검증이다. 이관한다고 줄이지 않는다.
  const type = ACCEPTED_MIME[file.type];
  if (!type) return NextResponse.json({ error: "지원하지 않는 파일 형식이에요" }, { status: 400 });
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "파일이 너무 커요 (50MB 이하)" }, { status: 400 });
  }

  const materialId = `ref_${crypto.randomUUID()}`;
  const ext = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const upload = await callBackend(
    req,
    `/files/${BUCKET}/${id}/${materialId}${ext ? `.${ext}` : ""}`,
    { method: "PUT", body: await file.arrayBuffer(), contentType: file.type },
  );
  if (!upload.ok) return NextResponse.json({ error: upload.message }, { status: upload.status });
  if (!upload.res.ok) {
    return NextResponse.json({ error: "파일을 올리지 못했어요." }, { status: upload.res.status });
  }
  const { path } = (await upload.res.json()) as { path: string };

  const row: MaterialRow = {
    id: materialId,
    brandProfileId: id,
    name: file.name,
    type,
    mimeType: file.type,
    sizeBytes: file.size,
    storageUrl: path,
    uploadedAt: Date.now(),
  };

  const save = await callBackend(req, "/stores/reference-materials", {
    method: "POST",
    body: JSON.stringify({ item: row }),
    contentType: "application/json",
  });
  if (!save.ok) return NextResponse.json({ error: save.message }, { status: save.status });
  if (!save.res.ok) {
    // 행이 없으면 이 파일에 닿을 길이 없다 — 고아를 만들지 않는다.
    await callBackend(req, `/files/${path}`, { method: "DELETE" });
    return NextResponse.json({ error: "참고 자료를 저장하지 못했어요." }, { status: save.res.status });
  }

  return NextResponse.json(expose(row));
}
