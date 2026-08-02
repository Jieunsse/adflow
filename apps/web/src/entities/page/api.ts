export type AdIdentityPage = {
  id: string;
  name: string;
  phone: string | null;
  igUserId: string | null;
  igUsername: string | null;
};

export const adIdentityPagesQueryKey = ["setup-pages"] as const;

export async function fetchAdIdentityPages(): Promise<AdIdentityPage[]> {
  const res = await fetch("/api/setup/pages");
  const data = await res.json() as { pages?: AdIdentityPage[]; error?: string };
  if (!res.ok || data.error) throw new Error(data.error ?? "페이지 목록을 불러오지 못했어요");
  return data.pages ?? [];
}
