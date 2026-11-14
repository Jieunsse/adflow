// 고객사 영업·계약·청구 기록 (기능 14, 정책서 27절). 서버 Client·ClientMemo·ClientBill 과 같은 모양이다.

export type ClientStage = "inquiry" | "consult" | "proposal" | "contract" | "renewal" | "ended";

export const STAGES: { key: ClientStage; label: string }[] = [
  { key: "inquiry", label: "문의" },
  { key: "consult", label: "상담" },
  { key: "proposal", label: "제안" },
  { key: "contract", label: "계약" },
  { key: "renewal", label: "재계약 대기" },
  { key: "ended", label: "종료" },
];

export const INQUIRY_SOURCES: { key: string; label: string }[] = [
  { key: "experiment_post", label: "실험 공개" },
  { key: "meta_ad", label: "Meta 광고" },
  { key: "referral", label: "소개" },
  { key: "other", label: "기타" },
];

export interface Client {
  id: string;
  name: string;
  contact?: string;
  industry?: string;
  inquirySource?: string;
  stage: ClientStage;
  managerEmail?: string;
  nextAction?: string;
  nextActionDate?: string;
  caseStudyConsent?: boolean;
  excludedIndustry?: boolean;
  product?: "light" | "standard";
  billingType?: "prepaid" | "postpaid";
  monthlyPrice?: number;
  contractStart?: string;
  contractEnd?: string;
  cancelNoticeDate?: string;
  cancelDate?: string;
  brandProfileId?: string;
  createdAt: string;
}

export interface ClientView {
  client: Client;
  overdue: boolean;
}

export interface ClientMemo {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface ClientBill {
  id?: string;
  contractMonth: number;
  billDate?: string;
  amount?: number;
  discount?: number;
  dueDate?: string;
  paidDate?: string;
  taxInvoiceNo?: string;
}

export interface Settlement {
  effectiveEnd: string;
  lastContractMonth: number;
  clawback: number;
}

export function stageLabel(s: ClientStage): string {
  return STAGES.find((x) => x.key === s)?.label ?? s;
}

export const won = (n?: number) => (n == null ? "—" : `${Math.round(n).toLocaleString("ko-KR")}원`);

/** 서버 문구({"error"})를 그대로 보여 준다. */
export async function clientsApi<T>(path: string, method: "GET" | "POST" | "PUT" = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`/api/clients${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "고객사 기록을 처리하지 못했어요. 잠시 뒤 다시 해 주세요.");
  return data;
}
