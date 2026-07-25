"use client";

import { useEffect, useState } from "react";
import type { Goal, GoalMetric } from "@entities/insights/goal";
import { bepRoas } from "@entities/insights/profit";
import { Card } from "@shared/ui/Card";
import { SegControl } from "@shared/ui/SegControl";
import { Button } from "@shared/ui/Button";
import { Callout } from "@shared/ui/Callout";

const METRIC_OPTIONS: { value: GoalMetric; label: string }[] = [
  { value: "roas", label: "ROAS" },
  { value: "contribution", label: "공헌이익 흑자" },
  { value: "cpa", label: "CPA" },
];

const PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: "30", label: "30일" },
  { value: "60", label: "60일" },
  { value: "90", label: "90일" },
];

function draftFromGoal(goal: Goal | null, metric: GoalMetric): string {
  if (goal && goal.lag.metric === metric) return String(goal.lag.target);
  return "";
}

export function GoalSetupForm({
  goal,
  marginRate,
  onSave,
  onCancel,
}: {
  goal: Goal | null;
  marginRate: number | null;
  onSave: (goal: Goal) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [metric, setMetric] = useState<GoalMetric>(goal?.lag.metric ?? "roas");
  const [draft, setDraft] = useState(() => draftFromGoal(goal, goal?.lag.metric ?? "roas"));
  const [periodDays, setPeriodDays] = useState(String(goal?.periodDays ?? 30));

  useEffect(() => {
    setName(goal?.name ?? "");
    setMetric(goal?.lag.metric ?? "roas");
    setDraft(draftFromGoal(goal, goal?.lag.metric ?? "roas"));
    setPeriodDays(String(goal?.periodDays ?? 30));
  }, [goal]);

  const changeMetric = (next: GoalMetric) => {
    setMetric(next);
    setDraft(draftFromGoal(goal, next));
  };

  const bep = bepRoas(marginRate);
  const isContribution = metric === "contribution";
  const target = Number(draft);
  const targetValid = isContribution || (draft.trim() !== "" && Number.isFinite(target) && target > 0);
  const nameValid = name.trim() !== "";

  const save = () => {
    if (!nameValid) return;
    const lagTarget = isContribution ? (bep ?? null) : target;
    if (lagTarget == null || (!isContribution && !targetValid)) return;

    onSave({
      id: goal?.id ?? crypto.randomUUID(),
      name: name.trim(),
      lag: { metric, target: lagTarget },
      leads: goal?.leads ?? [],
      periodDays: Number(periodDays),
      createdAt: goal?.createdAt ?? new Date().toISOString(),
    });
  };

  const saveDisabled = !nameValid || (isContribution ? bep == null : !targetValid);

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">
          {goal ? "목표 수정" : "목표 추가"}
        </h2>
        <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">
          이름을 정하고 어떤 후행 목표를 기준으로 삼을지 골라주세요.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)]">목표 이름</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 7월 신제품 런칭"
          className="w-full max-w-[320px] px-3 py-2 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-semibold text-[14px] text-[var(--w-fg-strong)] focus:outline-none focus:border-[var(--w-focus-ring)]"
        />
      </div>

      <SegControl value={metric} onChange={changeMetric} options={METRIC_OPTIONS} />

      {isContribution ? (
        <div className="flex flex-col gap-2.5">
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] m-0">
            공헌이익 흑자는 별도 목표값을 입력하지 않아요. 마진율로 계산한 손익분기 ROAS(BEP ROAS)가 곧 목표예요.
          </p>
          {marginRate == null ? (
            <Callout tone="cautionary" icon="warn">
              마진율이 아직 설정되지 않았어요.{" "}
              <a href="/brand-profile" className="font-semibold underline">브랜드 프로필에서 설정하기</a>
            </Callout>
          ) : (
            <div className="font-bold text-[20px] leading-[1.2] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)]">
              BEP ROAS {bep?.toFixed(2)}x
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            step={metric === "roas" ? 0.1 : 1}
            min={0}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={metric === "roas" ? "예: 3.0" : "예: 15000"}
            className="w-40 px-3 py-2 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-bold text-[18px] [font-family:var(--w-font-mono)] text-[var(--w-fg-strong)] text-right focus:outline-none focus:border-[var(--w-focus-ring)]"
          />
          <span className="font-bold text-[16px] text-[var(--w-fg-neutral)]">{metric === "roas" ? "x" : "원"}</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)]">추적 기간</span>
        <SegControl value={periodDays} onChange={setPeriodDays} options={PERIOD_OPTIONS} />
        <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-alternative)]">
          기간은 목표를 구분하는 메모예요 — 진척 판정은 최근 30일 실측으로 해요.
        </span>
      </div>

      <div className="flex gap-2">
        <Button variant="primary" size="sm" type="button" disabled={saveDisabled} onClick={save}>
          {goal ? "수정하기" : "저장하기"}
        </Button>
        <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
          취소
        </Button>
      </div>
    </Card>
  );
}
