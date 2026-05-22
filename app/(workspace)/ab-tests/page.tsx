"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import { SegControl } from "@shared/ui/SegControl";
import { fetchCampaigns } from "@entities/campaign/api";
import { MOCK_CAMPAIGN_SUMMARIES } from "@/lib/mock-campaigns";
import type { CampaignSummary } from "@/lib/meta-ads";

type Filter = "all" | "running" | "concluded";

const AXIS_LABEL: Record<string, string> = {
  headline: "헤드라인",
  primary_text: "광고 문구",
  image: "이미지",
};

const STATUS_MAP: Record<string, { label: string; chip: string }> = {
  live: { label: "게재 중", chip: "live" },
  paused: { label: "일시정지", chip: "paused" },
  ended: { label: "종료", chip: "ended" },
  review: { label: "검토 중", chip: "review" },
  issue: { label: "문제 있음", chip: "issue" },
};

const MOCK_AB_CAMPAIGNS = MOCK_CAMPAIGN_SUMMARIES.filter((c) => c.abTestEnabled);

function isRunning(c: CampaignSummary) {
  return c.status === "live" || c.status === "review";
}

export default function AbTestsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const connected = !!(session?.adAccountName && session?.pageName);
  const [filter, setFilter] = useState<Filter>("all");

  const campaignsQ = useQuery({
    queryKey: ["campaigns", "all"],
    queryFn: () => fetchCampaigns("all"),
    enabled: connected,
    retry: false,
  });

  const abCampaigns = (campaignsQ.data ?? []).filter((c) => c.abTestEnabled);

  const filtered = abCampaigns.filter((c) => {
    if (filter === "running") return isRunning(c);
    if (filter === "concluded") return !isRunning(c);
    return true;
  });

  const useMock = !connected || (!campaignsQ.isLoading && !campaignsQ.isError && filtered.length === 0);

  const mockFiltered = MOCK_AB_CAMPAIGNS.filter((c) => {
    if (filter === "running") return isRunning(c);
    if (filter === "concluded") return !isRunning(c);
    return true;
  });

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label="A/B 테스트">
      <div className="flex justify-between items-end gap-6">
        <div>
          <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]">A/B 테스트</h1>
          <p className="font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-neutral)] mt-1.5 mb-0">진행 중인 실험과 결과를 한눈에 확인해요</p>
        </div>
        <Button variant="primary" type="button" onClick={() => router.push("/ab-tests/new")}>
          <Icon name="plus" size={14} /> 새 A/B 테스트
        </Button>
      </div>

      <div className="mb-5">
        <SegControl
          options={[
            { label: "전체", value: "all" },
            { label: "진행 중", value: "running" },
            { label: "완료", value: "concluded" },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
        />
      </div>

      {campaignsQ.isLoading ? (
        <Card className="flex flex-col items-center gap-3 py-10 px-8">
          <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-7 h-7" />
          <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">불러오는 중…</div>
        </Card>
      ) : campaignsQ.isError ? (
        <EmptyCard
          icon="warn"
          title="불러오지 못했어요"
          sub={campaignsQ.error instanceof Error ? campaignsQ.error.message : "잠시 후 다시 시도해 주세요"}
          ctaLabel="다시 시도"
          onAction={() => campaignsQ.refetch()}
        />
      ) : useMock ? (
        <>
          <MockBanner connected={connected} onConnect={() => router.push("/connect")} onCreate={() => router.push("/create")} />
          {mockFiltered.length === 0 ? (
            <Card className="py-8 text-center text-[var(--w-fg-neutral)] font-medium text-[13px] leading-[1.5]">
              {filter === "running" ? "진행 중인 예시가 없어요" : "완료된 예시가 없어요"}
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {mockFiltered.map((c) => (
                <AbTestCard key={c.id} campaign={c} demo onClick={() => router.push(`/campaigns/${c.id}`)} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((c) => (
            <AbTestCard key={c.id} campaign={c} onClick={() => router.push(`/campaigns/${c.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MockBanner({ connected, onConnect, onCreate }: { connected: boolean; onConnect: () => void; onCreate: () => void }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-[10px] bg-[var(--w-primary-soft)] border border-[var(--w-primary-weak)] mb-4">
      <Icon name="eye" size={16} style={{ color: "var(--w-primary-normal)", flex: "0 0 auto" }} />
      <span className="flex-1 font-medium text-[13px] leading-[1.4] text-[var(--w-primary-press)]">
        {connected ? "아직 A/B 테스트가 없어요. 아래는 예시예요." : "계정 미연결 상태예요. 아래는 예시 데이터예요."}
      </span>
      {connected ? (
        <Button variant="primary" size="sm" type="button" onClick={onCreate}>광고 만들기</Button>
      ) : (
        <Button variant="primary" size="sm" type="button" onClick={onConnect}>계정 연결</Button>
      )}
    </div>
  );
}

function AbTestCard({ campaign: c, onClick, demo = false }: { campaign: CampaignSummary; onClick: () => void; demo?: boolean }) {
  const running = isRunning(c);
  const statusInfo = STATUS_MAP[c.status] ?? { label: c.status, chip: "neutral" };
  const axisLabel = AXIS_LABEL[c.abTestAxis ?? ""] ?? c.abTestAxis ?? "—";

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-2xl text-left cursor-pointer transition-[border-color] duration-[160ms] flex items-center gap-[18px] py-[18px] px-5 w-full"
      style={{ opacity: demo ? 0.85 : 1 }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: running ? "var(--w-primary-soft)" : "var(--w-bg-alternative)", color: running ? "var(--w-primary-normal)" : "var(--w-fg-alternative)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
        <Icon name="chart" size={20} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <Chip variant={statusInfo.chip as "live" | "paused" | "review" | "ended" | "issue" | "neutral"} dot>{statusInfo.label}</Chip>
          <Chip variant="neutral">{axisLabel} 축</Chip>
          {demo && <Chip variant="neutral" style={{ opacity: 0.7 }}>예시</Chip>}
        </div>
        <div className="font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)] mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
          {c.headline ?? c.name}
        </div>
        <div className="grid gap-x-2 gap-y-1 font-medium text-[12.5px] leading-[1.4] text-[var(--w-fg-neutral)]" style={{ gridTemplateColumns: "16px 1fr" }}>
          <span className="text-[var(--w-fg-alternative)] text-[10px] font-bold place-self-center">A</span>
          <span className="whitespace-nowrap overflow-hidden text-ellipsis">{c.abTestVariantA ?? "—"}</span>
          <span className="text-[var(--w-primary-normal)] text-[10px] font-bold place-self-center">B</span>
          <span className="whitespace-nowrap overflow-hidden text-ellipsis">{c.abTestVariantB ?? "—"}</span>
        </div>
      </div>

      <Icon name="arrow-right" size={16} style={{ color: "var(--w-fg-alternative)", flex: "0 0 auto" }} />
    </button>
  );
}

function EmptyCard({ icon, title, sub, ctaLabel, onAction }: { icon: import("@shared/ui/Icon").IconName; title: string; sub: string; ctaLabel: string; onAction: () => void }) {
  return (
    <Card className="py-12 px-8 flex flex-col items-center gap-3 text-center">
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--w-bg-alternative)", color: "var(--w-fg-alternative)", display: "grid", placeItems: "center" }}>
        <Icon name={icon} size={24} />
      </div>
      <div className="font-bold text-[17px] leading-[1.3] text-[var(--w-fg-strong)]">{title}</div>
      <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] max-w-[380px]">{sub}</div>
      <Button variant="secondary" type="button" className="mt-2" onClick={onAction}>{ctaLabel}</Button>
    </Card>
  );
}
