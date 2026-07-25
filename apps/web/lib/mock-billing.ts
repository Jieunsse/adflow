import type { Billing } from "@/src/entities/billing/types";

// 둘러보기 모드에서 /billing 페이지 UI 구조를 보여주기 위한 mock.
// 정상(active) 상태 — 알림 칩이 발동되지 않아 카드 5장 + 거래 내역 + 고객센터가 그대로 렌더된다.
export const MOCK_BILLING: Billing = {
  accountId: "act_demo_billing_1",
  accountName: "그린루틴 광고 계정",
  currency: "KRW",
  accountStatus: 1,
  balance: 32450,
  spendCap: 1500000,
  amountSpent: 1023700,
  fundingSources: [
    {
      id: "fund_demo_card_1",
      displayString: "Visa **** 4242",
      type: "CREDIT_CARD",
    },
  ],
  business: {
    name: "그린루틴",
    street: "서울특별시 성동구 왕십리로 50",
    city: "서울",
    state: null,
    zip: "04763",
    countryCode: "KR",
  },
};
