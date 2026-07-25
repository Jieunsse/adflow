import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseServer } from "@shared/lib/supabase-server";

const GRAPH = "https://graph.facebook.com/v20.0";

async function hasMetaAdAccounts(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${GRAPH}/me/adaccounts?limit=1&access_token=${accessToken}`,
      { cache: "no-store" },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { data?: unknown[] };
    return Array.isArray(data.data) && data.data.length > 0;
  } catch {
    return false;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ ok: false, onboarded: false }, { status: 401 });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, onboarded: false }, { status: 503 });

  const { data, error } = await supabase
    .from("onboarded_users")
    .select("user_email")
    .eq("user_email", email)
    .maybeSingle();

  if (error) {
    console.error("[onboarding/status] select failed", error);
    return NextResponse.json({ ok: false, onboarded: false, error: error.message }, { status: 500 });
  }

  if (data) return NextResponse.json({ ok: true, onboarded: true });

  // Backfill: 활성 사용자라면(Meta 광고 계정 보유) 자동 등록.
  if (session.accessToken && !session.browseMode) {
    const active = await hasMetaAdAccounts(session.accessToken);
    if (active) {
      await supabase.from("onboarded_users").upsert({ user_email: email });
      return NextResponse.json({ ok: true, onboarded: true });
    }
  }

  return NextResponse.json({ ok: true, onboarded: false });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ ok: false }, { status: 401 });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });

  const { error } = await supabase.from("onboarded_users").upsert({ user_email: email });
  if (error) {
    console.error("[onboarding/status] upsert failed", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ ok: false }, { status: 401 });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });

  await supabase.from("onboarded_users").delete().eq("user_email", email);
  return NextResponse.json({ ok: true });
}
