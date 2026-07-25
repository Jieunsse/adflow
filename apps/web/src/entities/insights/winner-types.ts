// 공유 타입 — server(lib/) 와 client(src/) 양쪽에서 import 가능.
// "use client" 없음 — 서버 모듈에서도 사용.

export type KpiTarget = {
  kpi: string;
  value: number;
  direction: "gte" | "lte";
};

export type WinnerEvidence =
  | {
      kind: "kpi-target";
      passed: { kpi: string; target: number; current: number; direction: "gte" | "lte" }[];
    }
  | {
      kind: "threshold";
      objective: string;
      passed: { metric: string; threshold: number; current: number }[];
    };
