"use client";

// 시안 1f — 생성 중. 3안 슬롯이 채워지는 걸 보여준다.
// 우리 `/api/generate-creative` 는 3안을 한 번에 돌려주므로 슬롯별 "완료"를 먼저 켜지 않는다.
// 막대는 경과 시간 기반 추정(약 4초)이고, 라벨도 그렇게 말한다 — 가짜 진행률을 만들지 않는다.

import { useEffect, useState } from "react";
import Icon from "@shared/ui/Icon";
import { Skeleton } from "@shared/ui/Skeleton";
import { recommendedHooks, COPY_HOOK_MAP, type ObjectiveId } from "@entities/creative/options";
import { PanelCard, VerLabel } from "./parts";

const EXPECTED_MS = 4000;

export default function GeneratingPanel({ outcome }: { outcome: ObjectiveId | null }) {
  const hooks = outcome ? recommendedHooks(outcome) : (["trendy", "story", "surprise"] as const);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 120);
    return () => clearInterval(id);
  }, []);

  // 예상 시간을 넘기면 90% 에서 멈춰 서 있는다 — 다 됐다고 거짓말하지 않으려고.
  const pct = Math.min(90, Math.round((elapsed / EXPECTED_MS) * 90));

  return (
    <div className="w-[404px] mx-auto bg-[var(--w-bg-alternative)] rounded-[var(--w-radius-16)] p-[18px]">
      <div className="flex items-center gap-2 mb-3.5">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-full bg-[var(--w-accent-violet-soft)] text-[var(--w-accent-violet)] font-semibold text-[12px] leading-[1.3]">
          <Icon name="sparkles" size={12} /> 3안 생성 중 · 약 4초
        </span>
        <span className="flex-1" />
        <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]">0 / 3 완료</span>
      </div>

      <div
        className="h-1 rounded-full bg-[var(--w-fill-normal)] mb-3.5 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="소재 3안 생성 중"
      >
        <span
          className="block h-full rounded-full bg-[var(--w-primary-normal)] transition-[width] duration-150 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        {hooks.map((h, i) => (
          <PanelCard key={h} className="p-3.5 shadow-none">
            <div className="flex items-center gap-1.5 mb-2.5">
              <VerLabel index={i} hook={h} />
              <span className="flex-1" />
              <span className="shrink-0 font-semibold text-[11px] leading-[1.3] text-[var(--w-accent-violet)] animate-pulse">
                쓰는 중…
              </span>
            </div>
            <Skeleton className="h-4 w-[72%]" />
            <div className="h-2" />
            <Skeleton className="h-[11px] w-[96%]" />
            <div className="h-1.5" />
            <Skeleton className="h-[11px] w-[58%]" />
          </PanelCard>
        ))}
      </div>
    </div>
  );
}
