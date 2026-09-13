import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@shared/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKETS = new Set(["product-images", "reference-materials", "published-media"]);

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const [bucket, ...parts] = path;
  const sb = getSupabaseServer();
  if (!sb || !BUCKETS.has(bucket) || parts.length === 0) return NextResponse.json({ error: "파일을 찾지 못했어요." }, { status: 404 });
  const url = sb.storage.from(bucket).getPublicUrl(parts.join("/")).data.publicUrl;
  const response = await fetch(url);
  if (!response.ok) return NextResponse.json({ error: "파일을 찾지 못했어요." }, { status: response.status });
  return new NextResponse(await response.arrayBuffer(), { status: 200, headers: { "content-type": response.headers.get("content-type") ?? "application/octet-stream", "cache-control": "public, max-age=60" } });
}
