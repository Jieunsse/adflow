import { getActiveId } from "@features/brand-profile/model/brandProfileStore";
import { fetchBrandConnection } from "@features/brand-profile/model/brandConnection";
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

/**
 * 연결 관리 화면의 "지금 연결 대상" — 지금 고른 브랜드의 광고 계정·페이지·픽셀 (기능 10). 브랜드마다 광고 계정
 * 1개라서 워크스페이스 하나의 값이 아니다. lastChange 는 아직 기록하지 않는다(변경 이력 기능 때 채운다).
 */
export async function fetchWorkspaceTarget(): Promise<WorkspaceTargetResponse> {
  const brandId = getActiveId();
  if (!brandId) return { target: {}, lastChange: null };
  const conn = await fetchBrandConnection(brandId);
  if (!conn) throw new Error("브랜드 연결 정보를 불러오지 못했어요.");
  return { target: conn, lastChange: null };
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
