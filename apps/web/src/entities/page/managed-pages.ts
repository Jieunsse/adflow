import type { FbManagedPagesResult } from "@/lib/facebook-pages";

export const managedPagesQueryKey = ["fb-pages"] as const;

export async function fetchManagedPages(): Promise<FbManagedPagesResult> {
  const res = await fetch("/api/facebook/pages");
  if (!res.ok) throw new Error("FB 페이지 목록을 불러오지 못했어요");
  return res.json() as Promise<FbManagedPagesResult>;
}
