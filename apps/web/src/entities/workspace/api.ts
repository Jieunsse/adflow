import { fetchAdIdentityPages } from "@entities/page/api";

export type WorkspaceTarget = {
  adAccountId?: string;
  adAccountName?: string;
  pageId?: string;
  pageName?: string;
  pixelId?: string;
  pixelName?: string;
  igUserId?: string;
  igUsername?: string;
};

export type WorkspaceTargetResponse = {
  target: WorkspaceTarget;
  lastChange: { actor: string; timestamp: string } | null;
};

export type AccountInfo = {
  connected: boolean;
  accountId: string;
  accountName: string;
  currency: string;
};

export type PickerKind = "account" | "page" | "pixel";

export type PickerItem = {
  id: string;
  name: string;
  currency?: string;
  status?: "active" | "disabled";
  igUserId?: string | null;
  igUsername?: string | null;
};

export const workspaceKeys = {
  target: ["workspace-meta-target"] as const,
  account: ["account"] as const,
  pickerAll: (kind: PickerKind) => ["workspace-picker", kind] as const,
  picker: (kind: PickerKind, adAccountId?: string) => ["workspace-picker", kind, adAccountId ?? null] as const,
};

export async function fetchWorkspaceTarget(): Promise<WorkspaceTargetResponse> {
  const res = await fetch("/api/workspace/meta-target");
  if (!res.ok) throw new Error("워크스페이스 연결 정보를 불러오지 못했어요.");
  return (await res.json()) as WorkspaceTargetResponse;
}

export async function fetchAccount(): Promise<AccountInfo> {
  const res = await fetch("/api/account");
  const data = await res.json();
  if (res.status === 401) {
    throw Object.assign(new Error(data?.error ?? "Meta 인증이 만료됐어요. 다시 로그인해주세요."), { code: 401 });
  }
  if (!res.ok) throw new Error(data?.error ?? "연결 정보를 불러오지 못했어요");
  return data as AccountInfo;
}

export async function fetchPickerList(kind: PickerKind, adAccountId?: string): Promise<PickerItem[]> {
  if (kind === "page") {
    return (await fetchAdIdentityPages()).map((page) => ({
      id: page.id,
      name: page.name,
      igUserId: page.igUserId,
      igUsername: page.igUsername,
    }));
  }

  const url = kind === "account"
    ? "/api/setup/ad-accounts"
    : `/api/setup/pixels${adAccountId ? `?adAccountId=${encodeURIComponent(adAccountId)}` : ""}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(data?.error ?? "목록을 불러오지 못했어요");
  if (kind === "account") {
    return ((data.accounts ?? []) as { id: string; name: string; currency: string; account_status: number }[]).map((account) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
      status: account.account_status === 1 ? "active" : "disabled",
    }));
  }
  return ((data.pixels ?? []) as { id: string; name: string }[]).map((pixel) => ({ id: pixel.id, name: pixel.name }));
}
