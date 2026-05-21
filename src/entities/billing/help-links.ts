// PRD-billing §4.4 — Meta 결제 페이지에 노출된 고객센터 링크 4개 미러.

export interface BillingHelpLink {
  label: string;
  href: string;
}

export const BILLING_HELP_LINKS: readonly BillingHelpLink[] = [
  {
    label: "청구 및 결제 문제 해결",
    href: "https://www.facebook.com/business/help/476448618664121",
  },
  {
    label: "광고 비용 청구 원리",
    href: "https://www.facebook.com/business/help/716180208457684",
  },
  {
    label: "결제에 실패한 경우 취할 조치",
    href: "https://www.facebook.com/business/help/268196136699959",
  },
  {
    label: "고객 센터 열기",
    href: "https://www.facebook.com/business/help",
  },
];
