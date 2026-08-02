import type { Billing } from "./types";

export type BillingQueryError = Error & { code?: number };

export const billingQueryKey = ["billing"] as const;

export async function fetchBilling(): Promise<Billing> {
  const res = await fetch("/api/billing");
  const data = await res.json() as Billing | { error?: string };
  const message = "error" in data ? data.error : undefined;
  if (res.status === 401) {
    throw Object.assign(new Error(message ?? "광고 계정을 먼저 연결해주세요."), { code: 401 }) as BillingQueryError;
  }
  if (!res.ok) throw new Error(message ?? "결제 정보를 불러오지 못했어요");
  return data as Billing;
}
