// 월간 계획 (기능 12). 서버가 주는 모양 그대로다. 실험 묶음은 서버가 JSON 문자열 한 칸으로 들고 있어 여기서 푼다.

export type PlanStatus = "draft" | "requested" | "approved" | "rejected";

export type MonthlyPlan = {
  id: string;
  brandProfileId: string;
  month: string;
  status: PlanStatus;
  budgetCap?: number;
  bundles?: string;
  messageToClient?: string;
  requestedBy?: string;
  requestedAt?: string;
  decidedBy?: string;
  decidedAt?: string;
  rejectReason?: string;
};

export type Bundle = { goal: string; product: string; axes: string; budget: number };

export const PLAN_STATUS_LABEL: Record<PlanStatus | "none", string> = {
  draft: "작성 중",
  requested: "승인 요청됨",
  approved: "승인됨",
  rejected: "반려됨",
  none: "없음",
};

export function parseBundles(raw: string | undefined): Bundle[] {
  try {
    const list = JSON.parse(raw ?? "[]") as Partial<Bundle>[];
    return list.map((b) => ({
      goal: b.goal ?? "",
      product: b.product ?? "",
      axes: b.axes ?? "",
      budget: Number(b.budget) || 0,
    }));
  } catch {
    return [];
  }
}

/** 한국 시간 기준 이번 달과 다음 달 (YYYY-MM). 서버가 계획 유무를 판단하는 기준과 같다. */
export function thisAndNextMonth(now: Date = new Date()): [string, string] {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const fmt = (yy: number, mm: number) => `${yy}-${String(mm + 1).padStart(2, "0")}`;
  return [fmt(y, m), m === 11 ? fmt(y + 1, 0) : fmt(y, m + 1)];
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

export async function planError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error ?? fallback;
}
