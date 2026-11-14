// 고객 화면 (기능 11). 서버 /portal/* 가 주는 모양 그대로다.

import type { ReportMetric } from "@entities/insights/period-report";

export type PortalLearning = { id: string; sentence?: string; tournamentId: string; roundIndex: number; productName?: string; decidedAt?: string; axis?: string };

export type Overview = {
  brandName: string;
  managerEmail?: string;
  month: string;
  planStatus?: "requested" | "approved" | "rejected";
  budgetCap?: number;
  monthSpend: number;
  runningExperiments: number;
  recentLearnings: PortalLearning[];
};

export type PortalExperiment = {
  id: string;
  productName: string;
  hypothesis?: string;
  axis?: string;
  launchedAt?: string;
  impressionShortfall?: number;
  champion?: { headline: string; primaryText: string };
  challenger?: { headline: string; primaryText: string };
};

export type SharedReport = {
  id: string;
  kind: "weekly" | "monthly";
  rangeStart: string;
  rangeEnd: string;
  metricsJson?: string;
  reasonsJson?: string;
  nextSteps?: string;
  sharedAt?: string;
};

export type SharedReason = { sentence?: string; tournamentId: string; roundIndex: number };

export function parseMetrics(r: SharedReport): ReportMetric[] {
  try {
    return JSON.parse(r.metricsJson ?? "[]") as ReportMetric[];
  } catch {
    return [];
  }
}

export function parseReasons(r: SharedReport): SharedReason[] {
  try {
    return JSON.parse(r.reasonsJson ?? "[]") as SharedReason[];
  } catch {
    return [];
  }
}

export const won = (n?: number | null) => (n == null ? "—" : `${Math.round(n).toLocaleString("ko-KR")}원`);
export const axisName = (a?: string) => (a === "primary_text" ? "본문" : "헤드라인");

export async function portalApi<T>(path: string, method: "GET" | "POST" | "PUT" = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`/api/portal${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "불러오지 못했어요. 잠시 뒤 다시 열어 주세요.");
  return data;
}
