// PROTOTYPE — /dashboard 벤토 리디자인 탐색용. 승자 확정 후 삭제.
// 변수 = 컴포넌트 스킨(austere/composed/expressive). 레이아웃은 고정.
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Card } from "@shared/ui/Card";
import { Button } from "@shared/ui/Button";
import { Badge, Sparkline } from "@shared/ui/primitives";
import Icon, { type IconName } from "@shared/ui/Icon";
import SpendPerfFlowCard from "@shared/ui/SpendPerfFlowCard";
import { PrototypeSwitcher } from "@shared/ui/PrototypeSwitcher";
import { cn } from "@shared/lib/cn";

type Skin = "austere" | "composed" | "expressive";

/* ── mock 데이터 (read-only, 실 API/store 무관) ─────────────────────── */

type VerdictStatus = "collecting" | "trap" | "poor" | "cruising" | "stable";
type Tone = "positive" | "negative" | "cautionary";

const VERDICT_UI: Record<VerdictStatus, { tone: Tone; icon: IconName; label: string }> = {
  collecting: { tone: "cautionary", icon: "clock", label: "데이터 모으는 중" },
  trap: { tone: "negative", icon: "warn", label: "함정 의심" },
  poor: { tone: "negative", icon: "warn", label: "점검 필요" },
  cruising: { tone: "positive", icon: "trend-up", label: "호조" },
  stable: { tone: "positive", icon: "check-circle", label: "안정적" },
};

const MOCK_VERDICT = {
  status: "trap" as VerdictStatus,
  headline: '"여름 신상 세일 컬렉션" 가짜 성과가 의심돼요',
  reasonLine: "클릭은 많지만 도착률 38% (<50%) — 픽셀·랜딩 점검이 필요해요",
  actionLabel: "광고 일시정지",
};

const MOCK_FLOW = {
  labels: ["6/22", "6/23", "6/24", "6/25", "6/26", "6/27", "6/28", "6/29"],
  spend: [42000, 51000, 48000, 60000, 72000, 81000, 88000, 95000],
  efficiency: [3.2, 3.4, 3.1, 2.9, 2.4, 2.1, 1.8, 1.6] as (number | null)[],
  verdict: "diverge" as const,
  perfLabel: "ROAS",
  shortLabel: "ROAS",
  subtitle: "지출은 늘었지만 효율은 뒷심이 빠지고 있어요.",
  midIndex: 4,
  earlyAvg: 3.15,
  lateAvg: 1.98,
  divergeRange: [4, 7] as [number, number],
  enough: true,
};

const MOCK_FUNNEL = [
  { label: "노출", value: 184_200, rate: null as string | null },
  { label: "클릭", value: 5_120, rate: "2.78%" },
  { label: "도착", value: 1_945, rate: "38.0%" },
  { label: "구매", value: 142, rate: "7.3%" },
];

type AccentToken = "var(--w-accent-violet)" | "var(--w-accent-cyan)" | "var(--w-primary-normal)";

const MOCK_KPI: {
  label: string; icon: IconName; value: string; suffix?: string; trend: number[];
  delta: string; dir: "up" | "down"; accent: AccentToken;
}[] = [
  { label: "평균 CTR", icon: "target", value: "2.78", suffix: "%", trend: [2.1, 2.3, 2.2, 2.5, 2.6, 2.7, 2.78], delta: "+0.34%p", dir: "up", accent: "var(--w-accent-violet)" },
  { label: "총지출 (7일)", icon: "wallet", value: "₩2.84M", trend: [42, 51, 48, 60, 72, 81, 95], delta: "+18%", dir: "up", accent: "var(--w-accent-cyan)" },
];

const MOCK_PROFIT = {
  contribution: "₩1,240,000",
  contributionTone: "positive" as Tone,
  bepRoas: "1.82",
  roas: "2.41",
  marginPct: 42,
};

/* ── 디자인된 모듈 (proto-로컬) ─────────────────────────────────────── */

function accentSoft(accent: string): string {
  if (accent.includes("violet")) return "var(--w-accent-violet-soft)";
  if (accent.includes("cyan")) return "var(--w-accent-cyan-soft)";
  return "var(--w-primary-soft)";
}

function IconChip({ icon, accent, skin, size = 36 }: { icon: IconName; accent?: string; skin: Skin; size?: number }) {
  const tinted = skin === "expressive" && !!accent;
  return (
    <span
      className="grid place-items-center rounded-[10px] shrink-0"
      style={{
        width: size,
        height: size,
        background: tinted ? accentSoft(accent!) : "var(--w-bg-neutral)",
        color: tinted ? accent : "var(--w-fg-neutral)",
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </span>
  );
}

function DeltaChip({ delta, dir, skin }: { delta: string; dir: "up" | "down"; skin: Skin }) {
  const neg = dir === "down";
  const color = neg ? "var(--w-status-negative)" : "var(--w-status-positive)";
  if (skin === "austere") {
    return (
      <span className="inline-flex items-center gap-0.5 font-semibold text-[12px] leading-none" style={{ color }}>
        <Icon name={neg ? "trend-down" : "trend-up"} size={13} /> {delta}
      </span>
    );
  }
  const bg = neg ? "var(--w-status-negative-soft)" : "var(--w-status-positive-soft)";
  return (
    <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full font-semibold text-[11.5px] leading-none" style={{ color, background: bg }}>
      <Icon name={neg ? "trend-down" : "trend-up"} size={12} /> {delta}
    </span>
  );
}

function StatCard({ stat, skin }: { stat: (typeof MOCK_KPI)[number]; skin: Skin }) {
  const vizColor =
    skin === "austere"
      ? "var(--w-data-muted)"
      : skin === "expressive"
        ? stat.accent
        : stat.dir === "down"
          ? "var(--w-status-negative)"
          : "var(--w-status-positive)";
  return (
    <Card className="rounded-2xl flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <IconChip icon={stat.icon} accent={stat.accent} skin={skin} />
        <span className="font-semibold text-[11px] leading-none uppercase tracking-[0.05em] text-[var(--w-fg-neutral)]">{stat.label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-bold text-[34px] leading-[1.0] tracking-[-0.028em] text-[var(--w-fg-strong)] [font-family:var(--w-font-mono)]">{stat.value}</span>
        {stat.suffix && <span className="font-semibold text-[18px] leading-none text-[var(--w-fg-neutral)]">{stat.suffix}</span>}
        <span className="ml-auto self-center"><DeltaChip delta={stat.delta} dir={stat.dir} skin={skin} /></span>
      </div>
      <div className="w-full">
        <Sparkline data={stat.trend} color={vizColor} fill height={skin === "austere" ? 24 : 32} />
      </div>
    </Card>
  );
}

function VerdictFeature() {
  const v = MOCK_VERDICT;
  const ui = VERDICT_UI[v.status];
  const soft = `var(--w-status-${ui.tone}-soft)`;
  const accent = `var(--w-status-${ui.tone})`;
  return (
    <div className="flex items-start gap-4 rounded-[20px]" style={{ background: soft, borderLeft: `4px solid ${accent}`, padding: 24 }}>
      <span className="grid place-items-center rounded-[12px] shrink-0" style={{ width: 48, height: 48, background: "var(--w-bg-elevated)", color: accent }}>
        <Icon name={ui.icon} size={26} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[11px] leading-none uppercase tracking-[0.05em]" style={{ color: accent }}>{ui.label}</div>
        <div className="w-h2 mt-1.5" style={{ textWrap: "pretty" }}>{v.headline}</div>
        <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1.5">{v.reasonLine}</div>
      </div>
      <div className="inline-flex gap-2 shrink-0">
        <Button variant="secondary" size="sm" type="button">{v.actionLabel}</Button>
        <Button variant="ghost" size="sm" type="button">상세 보기</Button>
      </div>
    </div>
  );
}

function Funnel({ skin }: { skin: Skin }) {
  const max = MOCK_FUNNEL[0].value;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <IconChip icon="chart" skin={skin} size={32} />
        <h3 className="m-0 font-bold text-[15px] leading-[1.3] tracking-[-0.01em] text-[var(--w-fg-strong)]">전환 퍼널</h3>
        <Badge kind="neutral" size="sm">최근 7일</Badge>
      </div>
      <div className="flex flex-col gap-1">
        {MOCK_FUNNEL.map((s, i) => {
          const prev = i > 0 ? MOCK_FUNNEL[i - 1] : null;
          return (
            <div key={s.label} className="flex flex-col">
              {prev && s.rate && (
                <div className="flex items-center gap-1.5 pl-1 py-0.5">
                  <span className="w-px h-3 bg-[var(--w-line-normal)]" />
                  {skin === "austere" ? (
                    <span className="font-semibold text-[10.5px] leading-none text-[var(--w-fg-alternative)]">↓ {s.rate}</span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[var(--w-bg-neutral)] font-semibold text-[10.5px] leading-none text-[var(--w-fg-neutral)]">↓ {s.rate}</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="w-9 font-medium text-[12px] leading-none text-[var(--w-fg-neutral)] shrink-0">{s.label}</span>
                <div className="flex-1 h-7 rounded-[8px] bg-[var(--w-bg-alternative)] overflow-hidden relative">
                  <div
                    className="h-full rounded-[8px]"
                    style={{
                      width: `${Math.max(8, (s.value / max) * 100)}%`,
                      background: skin === "expressive" ? "var(--w-accent-cyan-soft)" : "var(--w-data-muted)",
                      opacity: skin === "expressive" ? 1 : 1 - i * 0.14,
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-[13px] leading-none tabular-nums text-[var(--w-fg-strong)] [font-family:var(--w-font-mono)]">{s.value.toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function FlowCardRich({ skin }: { skin: Skin }) {
  return (
    <Card className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconChip icon="trend-up" accent="var(--w-primary-normal)" skin={skin} size={32} />
          <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">지출 대비 성과 흐름</h2>
        </div>
        <div className="inline-flex items-center rounded-[10px] bg-[var(--w-bg-neutral)] p-0.5">
          {["일별", "주별"].map((seg) => (
            <span
              key={seg}
              className={cn(
                "px-3 py-1.5 rounded-[8px] font-semibold text-[12px] leading-none cursor-default",
                seg === "일별"
                  ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[var(--w-shadow-card)]"
                  : "text-[var(--w-fg-alternative)]",
              )}
            >
              {seg}
            </span>
          ))}
        </div>
      </div>
      <div className="-mt-1">
        <SpendPerfFlowCard {...MOCK_FLOW} />
      </div>
    </Card>
  );
}

function ProfitCard({ skin }: { skin: Skin }) {
  const p = MOCK_PROFIT;
  const soft = `var(--w-status-${p.contributionTone}-soft)`;
  const accent = `var(--w-status-${p.contributionTone})`;
  return (
    <div className="flex flex-col gap-3.5 rounded-xl" style={{ background: soft, borderLeft: `4px solid ${accent}`, padding: "20px 22px" }}>
      <div className="flex items-center gap-2.5">
        <span className="grid place-items-center rounded-[10px] shrink-0" style={{ width: 32, height: 32, background: "var(--w-bg-elevated)", color: accent }}>
          <Icon name="wallet" size={17} />
        </span>
        <span className="font-semibold text-[11px] leading-none uppercase tracking-[0.05em] text-[var(--w-fg-neutral)]">공헌이익 · 7일</span>
        <Badge kind="neutral" size="sm">마진 {p.marginPct}%</Badge>
      </div>
      <span className="font-bold text-[32px] leading-[1.02] tracking-[-0.026em] [font-family:var(--w-font-mono)]" style={{ color: accent }}>{p.contribution}</span>
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--w-status-positive-line)]">
        <LabeledStat label="손익분기 ROAS" value={p.bepRoas} />
        <LabeledStat label="현재 ROAS" value={p.roas} accent={skin === "expressive" ? accent : undefined} ring={skin === "expressive"} />
      </div>
    </div>
  );
}

function LabeledStat({ label, value, accent, ring }: { label: string; value: string; accent?: string; ring?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {ring && accent && <ProgressRing pct={75} accent={accent} />}
      <div className="flex flex-col gap-1">
        <span className="font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">{label}</span>
        <span className="font-bold text-[16px] leading-none tabular-nums [font-family:var(--w-font-mono)]" style={{ color: accent ?? "var(--w-fg-strong)" }}>{value}</span>
      </div>
    </div>
  );
}

function ProgressRing({ pct, accent }: { pct: number; accent: string }) {
  const r = 13;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <svg width={32} height={32} viewBox="0 0 32 32" className="shrink-0 -rotate-90">
      <circle cx="16" cy="16" r={r} fill="none" stroke="var(--w-line-normal)" strokeWidth="3" />
      <circle cx="16" cy="16" r={r} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
    </svg>
  );
}

/* ── 고정 레이아웃 (변수 아님) ─────────────────────────────────────── */

function DashboardLayout({ skin }: { skin: Skin }) {
  return (
    <div className="flex flex-col gap-5">
      <VerdictFeature />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        <div className="flex flex-col gap-5">
          <FlowCardRich skin={skin} />
          <Funnel skin={skin} />
        </div>
        <div className="flex flex-col gap-4">
          {MOCK_KPI.map((s) => (
            <StatCard key={s.label} stat={s} skin={skin} />
          ))}
          <ProfitCard skin={skin} />
        </div>
      </div>
    </div>
  );
}

/* ── 라우트 ────────────────────────────────────────────────────────── */

const VARIANTS: { key: string; name: string; skin: Skin }[] = [
  { key: "A", name: "Austere", skin: "austere" },
  { key: "B", name: "Composed", skin: "composed" },
  { key: "C", name: "Expressive", skin: "expressive" },
];

export default function DashboardProtoPage() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = (params.get("variant") || "A").toUpperCase();
  const active = useMemo(() => VARIANTS.find((v) => v.key === raw) ?? VARIANTS[0], [raw]);

  const setVariant = (key: string) => router.replace(`/dashboard-proto?variant=${key}`);

  return (
    <div className="pb-24">
      <div className="mb-6">
        <h1 className="w-h1 m-0">대시보드</h1>
        <p className="font-medium text-[14px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1">
          벤토 리디자인 프로토타입 — 스킨 {active.key}: {active.name}
        </p>
      </div>

      <DashboardLayout skin={active.skin} />

      <PrototypeSwitcher
        variants={VARIANTS.map(({ key, name }) => ({ key, name }))}
        current={active.key}
        onChange={setVariant}
      />
    </div>
  );
}
