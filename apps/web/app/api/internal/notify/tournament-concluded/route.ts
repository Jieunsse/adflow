import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function POST() {
  return NextResponse.json({ error: "사용하지 않는 내부 경로예요." }, { status: 410 });
}
