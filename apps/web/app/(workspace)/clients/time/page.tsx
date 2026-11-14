"use client";

// 작업 시간 (기능명세 15-2, 고객사 관리의 "작업 시간" 탭). 이번 주 내 기록을 지우고 다시 남길 수 있고,
// 팀장은 직원별·브랜드별·단계별 주간 합계를 본다. 기록 자체는 사이드바 시계 단추로 한다.

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import { Skeleton } from "@shared/ui/Skeleton";
import { useToast } from "@shared/ui/Toast";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { hours, stageName, timeApi, type TimeEntry } from "@entities/time-entry/model";

type Summary = {
  weekStart: string;
  byMember: Record<string, number>;
  byBrand: Record<string, number>;
  byStage: Record<string, number>;
  byMemberAndBrand: { memberEmail: string; brandProfileId: string; minutes: number; over: boolean }[];
};

export default function TimePage() {
  const { data: session } = useSession();
  const isLead = session?.role === "팀장";
  const { profiles } = useBrandProfileStorage();
  const brandName = (id: string) => profiles.find((p) => p.id === id)?.name ?? "지운 브랜드";
  const qc = useQueryClient();
  const showToast = useToast();
  const ready = !!session && !session.browseMode;

  const mine = useQuery({ queryKey: ["time", "mine"], queryFn: () => timeApi<{ items: TimeEntry[] }>("").then((d) => d.items), enabled: ready });
  const summary = useQuery({ queryKey: ["time", "summary"], queryFn: () => timeApi<Summary>("/summary"), enabled: ready && isLead });

  const remove = async (id: string) => {
    try {
      await timeApi(`/${id}`, "DELETE");
      showToast("기록을 지웠어요");
      await qc.invalidateQueries({ queryKey: ["time"] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "기록을 지우지 못했어요.");
    }
  };

  const table = (title: string, rows: Record<string, number> | undefined, label: (k: string) => string) => (
    <Card className="p-5 flex flex-col gap-2">
      <h2 className="m-0 font-bold text-[15px] text-[var(--w-fg-strong)]">{title}</h2>
      {Object.entries(rows ?? {}).map(([k, m]) => (
        <div key={k} className="flex justify-between font-medium text-[13px]"><span>{label(k)}</span><span>{hours(m)}</span></div>
      ))}
    </Card>
  );

  return (
    <div className="px-12 py-9 pb-16 max-w-[960px] w-full mx-auto flex flex-col gap-6" data-screen-label="작업 시간">
      <div>
        <Link href="/clients" className="font-semibold text-[12px] text-[var(--w-fg-neutral)]">← 고객사 관리</Link>
        <h1 className="m-0 mt-1 font-bold text-[26px] text-[var(--w-fg-strong)]">작업 시간</h1>
        <p className="font-medium text-[14px] text-[var(--w-fg-neutral)] mt-1.5 mb-0">
          기록은 사이드바의 시계 단추로 남겨요. 이번 주 기록은 여기서 지우고 다시 남길 수 있어요.
        </p>
      </div>

      {!ready ? (
        <Card className="py-8 px-6 font-medium text-[13px] text-[var(--w-fg-neutral)]">둘러보기에서는 작업 시간을 저장하지 않아요.</Card>
      ) : mine.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <Card className="p-5 flex flex-col gap-2">
          <h2 className="m-0 font-bold text-[15px] text-[var(--w-fg-strong)]">이번 주 내 기록</h2>
          {(mine.data ?? []).length === 0 && <span className="font-medium text-[13px] text-[var(--w-fg-neutral)]">이번 주에 남긴 기록이 없어요.</span>}
          {(mine.data ?? []).map((e) => (
            <div key={e.id} className="flex items-center gap-4 font-medium text-[13px] border-b border-[var(--w-line-normal)] pb-2">
              <span className="w-24">{e.workDate}</span>
              <span className="w-32">{brandName(e.brandProfileId)}</span>
              <span className="w-28">{stageName(e.stage)}</span>
              <span>{hours(e.minutes)}</span>
              <Button className="ml-auto" variant="secondary" type="button" onClick={() => remove(e.id)}>지우기</Button>
            </div>
          ))}
        </Card>
      )}

      {isLead && summary.data && (
        <>
          <Card className="p-5 flex flex-col gap-2">
            <h2 className="m-0 font-bold text-[15px] text-[var(--w-fg-strong)]">이번 주 고객별 시간 ({summary.data.weekStart} 주)</h2>
            <p className="m-0 font-medium text-[12px] text-[var(--w-fg-neutral)]">고객 한 곳에 퍼포먼스 마케터 주 2시간, 콘텐츠 마케터 주 1시간을 넘으면 표시해요.</p>
            {summary.data.byMemberAndBrand.map((r) => (
              <div key={r.memberEmail + r.brandProfileId} className="flex items-center gap-4 font-medium text-[13px]">
                <span className="w-48">{r.memberEmail}</span>
                <span className="w-32">{brandName(r.brandProfileId)}</span>
                <span>{hours(r.minutes)}</span>
                {r.over && <Chip variant="warn">기준 넘음</Chip>}
              </div>
            ))}
          </Card>
          <div className="grid grid-cols-3 gap-3">
            {table("직원별", summary.data.byMember, (k) => k)}
            {table("브랜드별", summary.data.byBrand, brandName)}
            {table("단계별", summary.data.byStage, stageName)}
          </div>
        </>
      )}
    </div>
  );
}
