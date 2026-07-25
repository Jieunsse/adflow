// PRD-billing §6.2 — dashboard 결제 경고 칩 임계치 판정.
// 호출자는 [0] 만 보여주거나(=dashboard 칩) 전부 표시(=billing 페이지 안) 가능.

import type { Billing } from "./types";
import { accountStatusLabel } from "./labels";

export type AlertId = "payment_method_missing" | "spend_cap_warning" | "account_inactive";

export interface BillingAlert {
  id: AlertId;
  severity: "cautionary" | "negative";
  message: string; // 표시용 한국어
}

// 우선순위: account_inactive > payment_method_missing > spend_cap_warning.
const PRIORITY: Record<AlertId, number> = {
  account_inactive: 0,
  payment_method_missing: 1,
  spend_cap_warning: 2,
};

export function computeBillingAlerts(b: Billing): BillingAlert[] {
  const alerts: BillingAlert[] = [];

  if (b.accountStatus !== 1) {
    alerts.push({
      id: "account_inactive",
      severity: "negative",
      message: `광고 계정에 문제가 있어요 (${accountStatusLabel(b.accountStatus)})`,
    });
  }

  if (b.fundingSources.length === 0) {
    alerts.push({
      id: "payment_method_missing",
      severity: "negative",
      message: "결제 수단을 추가해주세요",
    });
  }

  if (b.spendCap != null && b.amountSpent != null && b.spendCap > 0) {
    const ratio = b.amountSpent / b.spendCap;
    if (ratio >= 0.8) {
      const pct = Math.floor(ratio * 100);
      alerts.push({
        id: "spend_cap_warning",
        severity: ratio >= 1 ? "negative" : "cautionary",
        message: `지출 한도의 ${pct}% 에 도달했어요`,
      });
    }
  }

  return alerts.sort((a, b) => PRIORITY[a.id] - PRIORITY[b.id]);
}
