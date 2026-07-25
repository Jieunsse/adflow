// Billing = Meta 광고 계정의 결제 정보. 도메인 어휘는 PRD-billing §7.
// 본 PRD 는 조회 전용 — 모든 변경 액션은 Meta 결제 페이지 deeplink.

// Meta account_status enum (Graph API 문서 §AdAccount).
export type AccountStatusCode = 1 | 2 | 3 | 7 | 9 | 100 | 101;

export interface FundingSource {
  id: string;
  displayString: string; // "Visa **** 1234" 같은 Meta 마스킹 문자열 — 그대로 표시
  type: string;          // 'CREDIT_CARD' 등 Meta 분류 문자열
}

export interface BusinessInfo {
  name: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  countryCode: string | null; // ISO 3166-1 alpha-2
}

export interface Billing {
  accountId: string;           // 'act_123' 형태 그대로
  accountName: string | null;
  currency: string;            // 'KRW' 등 ISO 4217
  accountStatus: AccountStatusCode | number; // Meta enum 밖이면 그대로 통과(라벨에서 "확인 필요" 처리)

  // 금액 — Meta 가 반환하는 currency minor unit 정수 그대로 보존. KRW 는 minor=0 이라 그냥 원.
  balance: number | null;
  spendCap: number | null;
  amountSpent: number | null;

  fundingSources: FundingSource[]; // 비어있으면 []
  business: BusinessInfo;
}
