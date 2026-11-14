import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGeminiKeySource, setGeminiApiKey } from "@/lib/gemini-credentials";

async function requireTeamLead(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  if (session.role !== "팀장") {
    return NextResponse.json({ error: "팀장만 Gemini API 키를 관리할 수 있어요." }, { status: 403 });
  }
  return null;
}

export async function GET(): Promise<Response> {
  const denied = await requireTeamLead();
  if (denied) return denied;
  const source = await getGeminiKeySource();
  return NextResponse.json({ configured: source !== null, source });
}

export async function POST(req: Request): Promise<Response> {
  const denied = await requireTeamLead();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { apiKey?: unknown } | null;
  if (!body || typeof body.apiKey !== "string" || !body.apiKey.trim()) {
    return NextResponse.json({ error: "Gemini API 키를 입력해주세요." }, { status: 400 });
  }

  await setGeminiApiKey(body.apiKey.trim());
  return NextResponse.json({ ok: true });
}
