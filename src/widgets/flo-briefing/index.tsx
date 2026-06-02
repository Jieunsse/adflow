"use client";

// 플로(Flo) Briefing 렌더 — 헤드라인 + Finding 카드 N개 (ADR-045).
// 각 Finding 은 진단 → 제안 → 대안 → 딥링크 순으로 보여준다.

import Link from "next/link";
import { Card } from "@shared/ui/Card";
import { Badge, type BadgeKind } from "@shared/ui/primitives";
import Icon from "@shared/ui/Icon";
import type { Briefing, Finding, FindingSeverity } from "@/lib/flo/types";

const SEVERITY: Record<FindingSeverity, { kind: BadgeKind; label: string }> = {
  good: { kind: "success", label: "좋아요" },
  info: { kind: "accent", label: "참고" },
  warn: { kind: "warn", label: "주의" },
};

function FindingCard({ f }: { f: Finding }) {
  const s = SEVERITY[f.severity];
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Badge kind={s.kind} dot>{s.label}</Badge>
        <h3 className="text-[15px] font-semibold text-[var(--w-fg-strong)]">{f.title}</h3>
      </div>
      <div className="flex flex-col gap-2.5 text-[13.5px] leading-relaxed">
        <p className="text-[var(--w-fg-neutral)]">{f.diagnosis}</p>
        <div className="flex gap-2">
          <span className="shrink-0 font-semibold text-[var(--w-primary-press)]">제안</span>
          <p className="text-[var(--w-fg-strong)]">{f.suggestion}</p>
        </div>
        {f.alternative && (
          <div className="flex gap-2">
            <span className="shrink-0 font-semibold text-[var(--w-fg-alternative)]">대안</span>
            <p className="text-[var(--w-fg-neutral)]">{f.alternative}</p>
          </div>
        )}
      </div>
      {f.action && (
        <Link
          href={f.action.href}
          className="inline-flex items-center gap-1 self-start text-[13px] font-semibold text-[var(--w-primary-press)] hover:underline"
        >
          {f.action.label}
          <Icon name="arrow-right" className="w-3.5 h-3.5" />
        </Link>
      )}
    </Card>
  );
}

export function FloBriefingView({ briefing }: { briefing: Briefing }) {
  return (
    <div className="flex flex-col gap-4">
      <Card variant="lg" className="bg-[var(--w-primary-soft)] border-transparent">
        <div className="flex items-start gap-3">
          <span className="text-[22px] leading-none">🌊</span>
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-[var(--w-primary-press)]">플로의 진단</span>
            <p className="text-[17px] font-semibold leading-snug text-[var(--w-fg-strong)]">
              {briefing.headline}
            </p>
          </div>
        </div>
      </Card>
      <div className="flex flex-col gap-3">
        {briefing.findings.map((f, i) => (
          <FindingCard key={i} f={f} />
        ))}
      </div>
    </div>
  );
}
