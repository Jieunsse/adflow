import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getFacebookManagedPages } from "@/lib/facebook-pages"

export async function GET() {
  const session = await getServerSession(authOptions)
  const data = await getFacebookManagedPages(session?.accessToken)
  return NextResponse.json(data)
}
