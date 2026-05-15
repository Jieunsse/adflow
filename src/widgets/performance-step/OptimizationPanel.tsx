"use client";

// 최적화 제안 + 자동화 준비도 패널 (active 상태) / 일시정지 카드 (paused 상태).

import Icon, { type IconName } from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
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
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ font: "700 15px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>이 광고는 일시정지 상태예요</div>
        <p style={{ font: "500 13px/1.6 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: 0 }}>
          다시 게재하려면 재개하거나, 성과가 부진했다면 새 소재로 다시 만드는 걸 권해요. Meta 광고 관리자에서 외부로 상태가 바뀌었다면 새로고침 후 다시 확인해주세요.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          <button className="btn btn--primary btn--sm" type="button" disabled={busy} onClick={onResume}>{busy ? "처리 중…" : "광고 재개"}</button>
          <button className="btn btn--ghost btn--sm" type="button" onClick={onRestart}>새 소재로 다시 만들기</button>
        </div>
      </div>
    );
  }

  const lockTitle = exampleMode ? "광고를 집행하면 활성화돼요" : undefined;

  return (
    <div className="card" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, alignItems: "flex-start" }}>
      <div>
        <h3 className="section-title">최적화 제안</h3>
        <p className="section-sub">제안은 직접 확인 후 적용해요. 자동으로 바뀌지 않아요.</p>
        <hr className="divider" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {suggestions.length === 0
            ? <p className="field__hint">지금은 특별히 권할 조정이 없어요. 데이터가 더 쌓이면 다시 살펴볼게요.</p>
            : suggestions.map((s, i) => {
                const warn = s.severity === "warn";
                return (
                  <OptCard key={i} icon={warn ? "warn" : "trend-up"} good={!warn} title={s.title} lines={s.detail}>
                    {s.kind === "pause" && (
                      <button className="btn btn--primary btn--sm" type="button" disabled={exampleMode || busy} title={lockTitle} onClick={onPause}>{busy ? "처리 중…" : "제안 집행하기"}</button>
                    )}
                    {s.kind === "increase-budget" && (
                      <button className="btn btn--primary btn--sm" type="button" disabled={exampleMode || busy} title={lockTitle} onClick={() => onIncreaseBudget(s.toDailyBudget)}>{busy ? "처리 중…" : "제안 집행하기"}</button>
                    )}
                  </OptCard>
                );
              })}
        </div>
        <div className="field__hint" style={{ marginTop: 12 }}>현재 일일예산은 {fmtKRW(dailyBudget)} 이에요.</div>
      </div>
      <div>
        <h3 className="section-title">자동화 준비도</h3>
        <p className="section-sub">충분한 데이터가 쌓이면 AI가 자동으로 광고를 운영할 수 있어요.</p>
        <hr className="divider" />
        {readiness.ready ? (
          <div style={{ background: "rgba(0,191,64,0.06)", border: "1px solid rgba(0,191,64,0.20)", borderRadius: 12, padding: 18 }}>
            <Badge kind="success" dot live>자동화 준비 완료</Badge>
            <div style={{ font: "700 16px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", marginTop: 10 }}>AI 자동 운영을 켤 수 있어요</div>
            <p style={{ font: "500 13px/1.55 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "8px 0 14px" }}>{readiness.reason}</p>
            <button className="btn btn--primary btn--sm" type="button" disabled title="자동 실행 환경 연동 후 활성화돼요">자동화 켜기 (연동 준비 중)</button>
          </div>
        ) : (
          <div style={{ background: "var(--w-bg-alternative)", borderRadius: 12, padding: 18 }}>
            <Badge kind="warn" dot>아직 준비 중</Badge>
            <div style={{ font: "700 16px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", marginTop: 10 }}>아직 자동화를 맡기기엔 지표가 아쉬워요</div>
            <p style={{ font: "500 13px/1.55 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "8px 0 0" }}>부족: {readiness.reason}. 데이터가 더 쌓이면 자동화를 제안해드릴게요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
