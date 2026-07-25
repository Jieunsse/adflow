// PRD-billing §7.4 — Meta account_status 코드 → 한국어 라벨.

const STATUS_LABEL: Record<number, string> = {
  1: "활성",
  2: "비활성",
  3: "미결제 잔액 있음",
  7: "위험 검토 중",
  9: "유예 기간",
  100: "폐쇄 대기",
  101: "폐쇄됨",
};

export function accountStatusLabel(code: number): string {
  return STATUS_LABEL[code] ?? "확인 필요";
}

const FUNDING_SOURCE_TYPE_LABEL: Record<string, string> = {
  CREDIT_CARD: "신용카드",
};

export function fundingSourceTypeLabel(type: string): string {
  return FUNDING_SOURCE_TYPE_LABEL[type] ?? type;
}
