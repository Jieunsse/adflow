"use client";

// 브랜드마다 광고 계정 1개 (기능 10). 서버의 브랜드 연결이 기준이고, 세션의 광고 계정은 지금 고른 브랜드의
// 연결을 따라간다. Meta 를 부르는 라우트 대부분이 세션 값을 읽기 때문이다.

export const ACTIVE_BRAND_EVENT = "adflow:active-brand";

export interface BrandConnection {
  adAccountId?: string;
  adAccountName?: string;
  pageId?: string;
  pageName?: string;
  pixelId?: string;
  pixelName?: string;
  igUserId?: string;
  igUsername?: string;
}

// 서버는 오류 문구를 응답에 싣지 않아서 상태 코드로 안내한다. 웹 라우트가 실은 문구(error)가 있으면 그것을 쓴다.
const MESSAGE_BY_STATUS: Record<number, string> = {
  403: "이 브랜드의 담당 직원과 팀장만 광고 계정을 연결할 수 있어요. 팀장에게 요청해 주세요.",
  404: "브랜드를 찾지 못했어요. 브랜드를 다시 골라 주세요.",
  409: "이 광고 계정은 이미 다른 브랜드에 연결돼 있어요. 다른 계정을 골라 주세요.",
};

/** 실패하면 화면에 보여 줄 문구를, 성공하면 null 을 준다. */
export async function saveBrandConnection(brandId: string, c: BrandConnection): Promise<string | null> {
  const res = await fetch(`/api/brands/${encodeURIComponent(brandId)}/connection`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(c),
  }).catch(() => null);
  if (res?.ok) return null;
  const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
  return (
    data?.error ??
    (res && MESSAGE_BY_STATUS[res.status]) ??
    "광고 계정을 브랜드에 저장하지 못했어요. 잠시 뒤 다시 해 주세요."
  );
}

/** 연결이 없으면 빈 객체. 서버에 닿지 못하면 null — 그때는 세션을 건드리지 않는다. */
export async function fetchBrandConnection(brandId: string): Promise<BrandConnection | null> {
  const res = await fetch(`/api/brands/${encodeURIComponent(brandId)}`).catch(() => null);
  if (res?.status === 404) return {};
  if (!res?.ok) return null;
  return (await res.json()) as BrandConnection;
}
