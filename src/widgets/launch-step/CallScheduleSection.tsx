"use client";

// PRD-objective-aware-launch §3 — leads_call 고유 섹션 + page phone callout.
// 광고 일정(캠페인 게재 기간)과는 별개의 *요일별 응대 가능 시간*. Meta business_hours 와 매핑.
// 휴일에 통화 광고 노출되면 미응대 → 광고비 낭비 가드.

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import { useLaunchDraft, type CallScheduleSlot } from "@entities/campaign/model";
import SubHead from "./SubHead";

type Page = { id: string; name: string; phone: string | null };

const DAYS = [
  { d: 1, label: "월" },
  { d: 2, label: "화" },
  { d: 3, label: "수" },
  { d: 4, label: "목" },
  { d: 5, label: "금" },
  { d: 6, label: "토" },
  { d: 0, label: "일" },
] as const;

const DEFAULT_SLOT = { start: "09:00", end: "18:00" } as const;

const chipBase = "inline-flex items-center gap-1.5 px-[14px] py-2 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-none text-[var(--w-fg-strong)] cursor-pointer transition-[background,border-color,color] duration-[120ms]";
const chipOn = "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]";

export default function CallScheduleSection() {
  const { state, dispatch } = useLaunchDraft();
  const { data: session } = useSession();

  const { data: pagesData } = useQuery({
    queryKey: ["setup-pages"],
    queryFn: async (): Promise<{ pages: Page[] }> => {
      const res = await fetch("/api/setup/pages");
      if (!res.ok) throw new Error("페이지 조회 실패");
      return res.json();
    },
    enabled: !!session?.pageId,
  });
  const activePage = pagesData?.pages.find((p) => p.id === session?.pageId);
  const phoneMissing = activePage !== undefined && !activePage.phone;

  const slots = state.callSchedule;
  const dayOn = (d: number) => slots.some((s) => s.day === d);
  const slotFor = (d: number): CallScheduleSlot | undefined => slots.find((s) => s.day === d);

  const toggleDay = (d: number) => {
    const next = dayOn(d)
      ? slots.filter((s) => s.day !== d)
      : [...slots, { day: d, start: DEFAULT_SLOT.start, end: DEFAULT_SLOT.end }];
    dispatch({ type: "SET_CALL_SCHEDULE", value: next });
  };
  const updateSlot = (d: number, patch: Partial<Pick<CallScheduleSlot, "start" | "end">>) => {
    const next = slots.map((s) => (s.day === d ? { ...s, ...patch } : s));
    dispatch({ type: "SET_CALL_SCHEDULE", value: next });
  };

  return (
    <div id="call-schedule">
      <SubHead title="통화 가능 시간대" subtitle="광고를 본 사람이 전화했을 때 응대 가능한 요일·시간을 골라주세요. 휴일에 광고비가 새는 걸 막아요." />

      {phoneMissing && (
        <div className="flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] border bg-[rgba(255,146,0,0.10)] border-[rgba(255,146,0,0.24)] text-[var(--w-status-cautionary)] mb-3">
          <Icon name="warn" size={16} />
          <div className="font-medium text-[12.5px] leading-[1.5]">
            활성 페이지 <strong>{activePage?.name}</strong> 에 전화번호가 등록돼있지 않아요. 전화 받기 광고는 페이지 전화번호가 필수예요.
            <br />
            Meta 페이지 설정 → 정보 → 전화번호 에서 추가하면 활성화돼요.
          </div>
        </div>
      )}

      {!phoneMissing && activePage?.phone && (
        <div className="flex items-center gap-1.5 font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-primary-press)] mb-3">
          <Icon name="phone" size={12} /> 통화 연결 번호: {activePage.phone}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {DAYS.map((d) => (
          <button
            key={d.d}
            type="button"
            className={cn(chipBase, dayOn(d.d) && chipOn)}
            onClick={() => toggleDay(d.d)}
          >
            {d.label}
          </button>
        ))}
      </div>

      {slots.length > 0 && (
        <div className="flex flex-col gap-2">
          {[...slots].sort((a, b) => (a.day === 0 ? 7 : a.day) - (b.day === 0 ? 7 : b.day)).map((s) => {
            const dayLabel = DAYS.find((d) => d.d === s.day)?.label ?? "";
            return (
              <div key={s.day} className="grid gap-2 items-center" style={{ gridTemplateColumns: "40px 1fr auto 1fr" }}>
                <span className="font-semibold text-[12.5px] leading-none text-[var(--w-fg-strong)]">{dayLabel}</span>
                <input
                  type="time"
                  className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]"
                  value={slotFor(s.day)?.start ?? DEFAULT_SLOT.start}
                  onChange={(e) => updateSlot(s.day, { start: e.target.value })}
                  aria-label={`${dayLabel} 시작`}
                />
                <span className="text-[var(--w-fg-neutral)]">—</span>
                <input
                  type="time"
                  className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]"
                  value={slotFor(s.day)?.end ?? DEFAULT_SLOT.end}
                  onChange={(e) => updateSlot(s.day, { end: e.target.value })}
                  aria-label={`${dayLabel} 종료`}
                />
              </div>
            );
          })}
        </div>
      )}

      {slots.length === 0 && (
        <div className="flex items-center gap-1.5 font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-status-cautionary)]">
          <Icon name="warn" size={12} /> 최소 1개 요일을 골라주세요. 광고 게재 전 차단돼요.
        </div>
      )}
    </div>
  );
}
