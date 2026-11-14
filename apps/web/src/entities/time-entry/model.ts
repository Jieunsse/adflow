// 작업 시간 기록 (기능 15, 정책서 28절).

export const TIME_STAGES: { key: string; label: string }[] = [
  { key: "onboarding", label: "시작 준비" },
  { key: "monthly_plan", label: "월간 계획" },
  { key: "creative", label: "소재" },
  { key: "review", label: "검수" },
  { key: "launch", label: "게재와 판정" },
  { key: "report", label: "리포트와 통화" },
  { key: "sales", label: "영업" },
];

export const QUICK_MINUTES = [15, 30, 45, 60, 90, 120];

export interface TimeEntry {
  id: string;
  memberEmail: string;
  brandProfileId: string;
  stage: string;
  minutes: number;
  workDate: string;
}

export const stageName = (k: string) => TIME_STAGES.find((s) => s.key === k)?.label ?? k;
export const hours = (m: number) => (m % 60 === 0 ? `${m / 60}시간` : m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간 ${m % 60}분`);

export async function timeApi<T>(path: string, method: "GET" | "POST" | "DELETE" = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`/api/time-entries${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "작업 시간을 저장하지 못했어요. 잠시 뒤 다시 해 주세요.");
  return data;
}
