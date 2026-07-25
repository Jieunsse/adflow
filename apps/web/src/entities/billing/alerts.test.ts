import { describe, expect, it } from "vitest";
import { computeBillingAlerts } from "./alerts";
import type { Billing, FundingSource } from "./types";

// 회귀 안전망 — PRD-billing §6.2 임계치 + §11.1 케이스 표.
// pure function outcome 테스트만 (UI 테스트는 ADR-002 정책상 비목표).

const sampleCard: FundingSource = { id: "fs_1", displayString: "Visa **** 1234", type: "CREDIT_CARD" };

function base(overrides: Partial<Billing> = {}): Billing {
  return {
    accountId: "act_1",
    accountName: "Test Account",
    currency: "KRW",
    accountStatus: 1,
    balance: 0,
    spendCap: null,
    amountSpent: null,
    fundingSources: [sampleCard],
    business: { name: null, street: null, city: null, state: null, zip: null, countryCode: null },
    ...overrides,
  };
}

describe("computeBillingAlerts", () => {
  it("정상 — 비활성 없음 / 결제수단 있음 / 한도 80% 미만 → 빈 배열", () => {
    const result = computeBillingAlerts(base({ spendCap: 10000, amountSpent: 5000 }));
    expect(result).toEqual([]);
  });

  it("결제수단 없음 → payment_method_missing 발동", () => {
    const result = computeBillingAlerts(base({ fundingSources: [] }));
    expect(result.map((a) => a.id)).toEqual(["payment_method_missing"]);
  });

  it("한도 80% 정확 → spend_cap_warning 발동 (cautionary)", () => {
    const result = computeBillingAlerts(base({ spendCap: 10000, amountSpent: 8000 }));
    expect(result.map((a) => a.id)).toEqual(["spend_cap_warning"]);
    expect(result[0].severity).toBe("cautionary");
  });

  it("한도 79.9% → 미발동", () => {
    const result = computeBillingAlerts(base({ spendCap: 10000, amountSpent: 7990 }));
    expect(result).toEqual([]);
  });

  it("한도 100% 초과 → spend_cap_warning (severity=negative)", () => {
    const result = computeBillingAlerts(base({ spendCap: 10000, amountSpent: 12000 }));
    expect(result.map((a) => a.id)).toEqual(["spend_cap_warning"]);
    expect(result[0].severity).toBe("negative");
  });

  it("한도 미설정 (spendCap=null) → spend_cap_warning 미발동", () => {
    const result = computeBillingAlerts(base({ spendCap: null, amountSpent: 100000 }));
    expect(result).toEqual([]);
  });

  it("amountSpent 누락 → spend_cap_warning 미발동", () => {
    const result = computeBillingAlerts(base({ spendCap: 10000, amountSpent: null }));
    expect(result).toEqual([]);
  });

  it("계정 비활성 (accountStatus=2) → account_inactive 포함", () => {
    const result = computeBillingAlerts(base({ accountStatus: 2 }));
    expect(result.map((a) => a.id)).toContain("account_inactive");
  });

  it("계정 비활성 + 결제수단 없음 → 우선순위 [account_inactive, payment_method_missing]", () => {
    const result = computeBillingAlerts(base({ accountStatus: 2, fundingSources: [] }));
    expect(result.map((a) => a.id)).toEqual(["account_inactive", "payment_method_missing"]);
  });

  it("셋 다 발동 → [account_inactive, payment_method_missing, spend_cap_warning] 순", () => {
    const result = computeBillingAlerts(
      base({ accountStatus: 2, fundingSources: [], spendCap: 10000, amountSpent: 9000 }),
    );
    expect(result.map((a) => a.id)).toEqual([
      "account_inactive",
      "payment_method_missing",
      "spend_cap_warning",
    ]);
  });
});
