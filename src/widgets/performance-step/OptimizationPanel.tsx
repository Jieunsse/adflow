"use client";

// 최적화 제안 + 자동화 준비도 패널 (active 상태) / 일시정지 카드 (paused 상태).

import Icon, { type IconName } from "@shared/ui/Icon";
import { Card } from "@shared/ui/Card";
import { Button } from "@shared/ui/Button";
import { Chip } from "@shared/ui/Chip";
import { fmtKRW } from "@shared/lib/format";
import { type Suggestion, type AutomationReadiness } from "@entities/insights/optimization";

interface Props {
  isPaused: boolean;
  suggestions: Suggestion[];
  readiness: AutomationReadiness;
  dailyBudget: number;
  exampleMode: boolean;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onIncreaseBudget: (to: number) => void;
  onRestart: () => void;
}

function OptCard({ icon, good, title, lines, children }: { icon: IconName; good: boolean; title: string; lines: string[]; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, padding: 14, border: "1px solid var(--w-line-alternative)", borderRadius: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: good ? "rgba(0,191,64,0.10)" : "rgba(255,146,0,0.12)", color: good ? "var(--w-status-positive)" : "var(--w-status-cautionary)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
        <Icon name={icon} size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "600 14px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{title}</div>
        {lines.map((l, j) => (
          <div key={j} style={{ font: "500 12.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>{l}</div>
        ))}
        {children && <div style={{ marginTop: 10 }}>{children}</div>}
      </div>
    </div>
  );
}

export default function OptimizationPanel({ isPaused, suggestions, readiness, dailyBudget, exampleMode, busy, onPause, onResume, onIncreaseBudget, onRestart }: Props) {
  if (isPaused) {
    return (
      <Card className="flex flex-col gap-2.5">
        <div className="font-bold text-[15px] leading-[1.3] text-[var(--w-fg-strong)]">이 광고는 일시정지 상태예요</div>
        <p className="font-medium text-[13px] leading-[1.6] text-[var(--w-fg-neutral)] m-0">
          다시 게재하려면 재개하거나, 성과가 부진했다면 새 소재로 다시 만드는 걸 권해요. Meta 광고 관리자에서 외부로 상태가 바뀌었다면 새로고침 후 다시 확인해주세요.
        </p>
        <div className="flex gap-2 mt-1 flex-wrap">
          <Button variant="primary" size="sm" disabled={busy} onClick={onResume}>{busy ? "처리 중…" : "광고 재개"}</Button>
          <Button variant="ghost" size="sm" onClick={onRestart}>새 소재로 다시 만들기</Button>
        </div>
      </Card>
    );
  }

  const lockTitle = exampleMode ? "광고를 집행하면 활성화돼요" : undefined;

  return (
    <Card className="grid grid-cols-[1.2fr_1fr] gap-6 items-start">
      <div>
        <h3 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">최적화 제안</h3>
        <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">제안은 직접 확인 후 적용해요. 자동으로 바뀌지 않아요.</p>
        <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
        <div className="flex flex-col gap-3">
          {suggestions.length === 0
            ? <p className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)]">지금은 특별히 권할 조정이 없어요. 데이터가 더 쌓이면 다시 살펴볼게요.</p>
            : suggestions.map((s, i) => {
                const warn = s.severity === "warn";
                return (
                  <OptCard key={i} icon={warn ? "warn" : "trend-up"} good={!warn} title={s.title} lines={s.detail}>
                    {s.kind === "pause" && (
                      <Button variant="primary" size="sm" disabled={exampleMode || busy} title={lockTitle} onClick={onPause}>{busy ? "처리 중…" : "제안 집행하기"}</Button>
                    )}
                    {s.kind === "increase-budget" && (
                      <Button variant="primary" size="sm" disabled={exampleMode || busy} title={lockTitle} onClick={() => onIncreaseBudget(s.toDailyBudget)}>{busy ? "처리 중…" : "제안 집행하기"}</Button>
                    )}
                  </OptCard>
                );
              })}
        </div>
        <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)] mt-3">현재 일일예산은 {fmtKRW(dailyBudget)} 이에요.</div>
      </div>
      <div>
        <h3 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">자동화 준비도</h3>
        <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">충분한 데이터가 쌓이면 AI가 자동으로 광고를 운영할 수 있어요.</p>
        <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
        {readiness.ready ? (
          <div className="bg-[var(--w-bg-alternative)] rounded-xl p-[18px]">
            <Chip variant="neutral" dot>지표 조건 충족</Chip>
            <div className="font-bold text-[16px] leading-[1.3] text-[var(--w-fg-strong)] mt-2.5">자동 운영 기능을 준비하고 있어요</div>
            <p className="font-medium text-[13px] leading-[1.55] text-[var(--w-fg-neutral)] mt-2 mb-0">{readiness.reason}</p>
          </div>
        ) : (
          <div className="bg-[var(--w-bg-alternative)] rounded-xl p-[18px]">
            <Chip variant="warn" dot>아직 준비 중</Chip>
            <div className="font-bold text-[16px] leading-[1.3] text-[var(--w-fg-strong)] mt-2.5">아직 자동화를 맡기기엔 지표가 아쉬워요</div>
            <p className="font-medium text-[13px] leading-[1.55] text-[var(--w-fg-neutral)] mt-2 mb-0">부족: {readiness.reason}. 데이터가 더 쌓이면 자동화를 제안해드릴게요.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
