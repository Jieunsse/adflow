// ADR-062 Decision 4 — CA ToS 에러 = lib/meta-ads-campaign.ts 의 mapSplitTestError 패턴과 동형.
// 최초 생성 시 광고 계정 단위 약관 수락이 필요한 경우(#2654 계열) API 대리 수락이 불가능해서
// 한국어 안내 + Ads Manager 수락 딥링크로 우회한다. 사전 탐지 불가 — 실패 지점에서만 매핑.

export interface MetaAudienceApiError {
  code: number;
  subcode?: number;
  userMessage?: string;
}

export interface AudienceErrorResult {
  message: string;
  tosAcceptUrl?: string;
}

const CA_TOS_ERROR_CODE = 2654;

// accountId 는 'act_123...' 또는 '123...' 둘 다 들어올 수 있어 숫자부만 추출.
function accountNumericId(accountId: string): string {
  return accountId.replace(/^act_/, "");
}

export function mapAudienceError(err: MetaAudienceApiError, accountId: string): AudienceErrorResult {
  if (err.code === CA_TOS_ERROR_CODE) {
    return {
      message: "광고 계정에서 맞춤 타겟 약관 수락이 필요해요",
      tosAcceptUrl: `https://business.facebook.com/ads/manage/customaudiences/tos/?act=${accountNumericId(accountId)}`,
    };
  }
  if (err.userMessage) return { message: err.userMessage };
  return { message: "맞춤 타겟을 만들지 못했어요. 잠시 후 다시 시도해주세요." };
}
