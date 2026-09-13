import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { isRealOwner } from "@shared/lib/store/ownerKey";

export async function getSupabaseOwner(req: NextRequest): Promise<string | null> {
  const email = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET }))?.email;
  return isRealOwner(typeof email === "string" ? email : null) ? email as string : null;
}
