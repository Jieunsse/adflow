import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const raw = req.cookies.get("adflow_ig_pending")?.value
  if (!raw) return NextResponse.json({ error: "No pending connection" }, { status: 404 })

  try {
    const data = JSON.parse(raw) as { igAccessToken: string; igUserId: string; igUsername: string }
    const res = NextResponse.json(data)
    res.cookies.delete("adflow_ig_pending")
    return res
  } catch {
    return NextResponse.json({ error: "Invalid pending data" }, { status: 400 })
  }
}
