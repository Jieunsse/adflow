"use client";

import { useSession } from "next-auth/react";
import { BROWSE_IG_ACCOUNT } from "@shared/lib/browse-connection";

/** 목업에 찍히는 계정 이름. 둘러보기는 가상 브랜드(그린루틴) 계정을 쓴다. */
export function useBrandHandle(): string {
  const { data: session } = useSession();
  return session?.browseMode ? BROWSE_IG_ACCOUNT.username : session?.igUsername ?? "my_brand";
}
