// ADR-046 — Synced Store API(creators, ADR-065 §9). createSyncedStore 가 HTTP 로 호출.
// 전송/보안: NextAuth 세션의 Owner Key(email)로 service-role(getSupabaseServer) 스코핑.
// 게스트/미로그인은 클라가 API 를 단락하므로 도달 시 401(방어).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRouteHandler, ValidationError } from "@/lib/route-handler";
import { getSupabaseServer } from "@shared/lib/supabase-server";
import { isRealOwner } from "@shared/lib/store/ownerKey";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABLE = "creators";

// Owner Key 게이트 — 실유저만 통과. email 반환 또는 401 응답.
async function requireOwner(): Promise<string | NextResponse> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;
  if (!isRealOwner(email)) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  return email;
}

function db() {
  const c = getSupabaseServer();
  if (!c) throw new Error("Supabase 가 구성되지 않았어요.");
  return c;
}

export async function GET() {
  const owner = await requireOwner();
  if (owner instanceof NextResponse) return owner;
  return withRouteHandler(true, "", async () => {
    const { data, error } = await db()
      .from(TABLE)
      .select("data")
      .eq("user_email", owner)
      .order("synced_at", { ascending: false });
    if (error) throw error;
    const items = ((data as { data: unknown }[]) ?? []).map((r) => r.data);
    return NextResponse.json({ items });
  });
}

export async function POST(req: NextRequest) {
  const owner = await requireOwner();
  if (owner instanceof NextResponse) return owner;
  return withRouteHandler(true, "", async () => {
    const body = (await req.json()) as { item?: { id?: string } };
    const item = body.item;
    if (!item?.id) throw new ValidationError("저장할 항목이 없어요.");
    const { error } = await db().from(TABLE).upsert({
      id: item.id,
      user_email: owner,
      data: item,
      synced_at: new Date().toISOString(),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req: NextRequest) {
  const owner = await requireOwner();
  if (owner instanceof NextResponse) return owner;
  return withRouteHandler(true, "", async () => {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) throw new ValidationError("삭제할 id 가 없어요.");
    // owner 스코프 동시 매칭 — 자기 행만 삭제(service-role 이라도 방어).
    const { error } = await db().from(TABLE).delete().eq("id", id).eq("user_email", owner);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  });
}
