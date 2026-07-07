"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import Icon from "@shared/ui/Icon";
import { EmptyState } from "@shared/ui/primitives";
import { useToast } from "@shared/ui/Toast";
import { useCreators } from "@entities/creator/store";
import { useInfluencerCampaigns } from "@entities/influencer-campaign/store";
import { seedInfluencerDemo } from "@entities/creator/browse/seed";
import { rankCreators } from "@entities/creator/ranking";
import { aggregateCampaignPerformance, applyPerformanceToHistory } from "@entities/creator/aggregate";
import { buildPerCreatorRows, serializeInfluencerReportText, toInfluencerCampaignCsv } from "@entities/influencer-campaign/report";
import type { InfluencerReportInsight } from "@entities/influencer-campaign/report";
import type { CampaignEntry, CampaignStage } from "@entities/influencer-campaign/model";
import type { CreatorPerformance } from "@entities/creator/model";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import {
  RankingPanel,
  RankingEmptyState,
  PipelineBoard,
  OutreachDraftModal,
  ContentGuidelineModal,
  PerformanceInputModal,
  SettleConfirmModal,
} from "@features/creator-pipeline";
import type { GenerateContentGuidelineResult } from "@/lib/prompts/creator-content-guideline";

type ModalState =
  | { kind: "outreach"; creatorId: string }
  | { kind: "guideline"; creatorId: string }
  | { kind: "performance"; creatorId: string; settleAfterSave?: boolean }
  | { kind: "settle-confirm"; creatorId: string }
  | null;

export default function InfluencerCampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;
  const showToast = useToast();

  useEffect(() => {
    if (!browseMode) return;
    seedInfluencerDemo();
  }, [browseMode]);

  const { list: campaigns, upsert: upsertCampaign } = useInfluencerCampaigns();
  const { list: creators, upsert: upsertCreator } = useCreators();
  const { profiles } = useBrandProfileStorage();

  const campaign = campaigns.find((c) => c.id === params.id);
  const brandProfile = profiles.find((p) => p.id === campaign?.brandProfileId);

  const [modal, setModal] = useState<ModalState>(null);
  const [outreachDraft, setOutreachDraft] = useState("");
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [guideline, setGuideline] = useState<GenerateContentGuidelineResult | null>(null);
  const [guidelineLoading, setGuidelineLoading] = useState(false);
  const [guidelineError, setGuidelineError] = useState<string | null>(null);

  const [insight, setInsight] = useState<InfluencerReportInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  const entries = useMemo(() => campaign?.entries ?? [], [campaign]);
  const pipelineCreatorIds = useMemo(() => new Set(entries.map((e) => e.creatorId)), [entries]);

  const candidates = useMemo(
    () => creators.filter((c) => !pipelineCreatorIds.has(c.id)),
    [creators, pipelineCreatorIds],
  );

  const rankResults = useMemo(() => {
    if (!campaign) return [];
    return rankCreators(candidates, campaign);
  }, [candidates, campaign]);

  const hasAnyHistory = useMemo(
    () => candidates.some((c) => c.performanceHistory.length > 0),
    [candidates],
  );

  const aggregated = useMemo(() => aggregateCampaignPerformance(entries), [entries]);
  const perCreatorRows = useMemo(() => (campaign ? buildPerCreatorRows(campaign, creators) : []), [campaign, creators]);

  if (!campaign) {
    return (
      <div className="w-full max-w-[1080px] mx-auto px-12 py-10 pb-24">
        <EmptyState
          icon={<Icon name="megaphone" size={22} />}
          title="캠페인을 찾을 수 없어요"
          desc="삭제됐거나 잘못된 주소예요."
          action={
            <Link href="/creators/campaigns" className="no-underline">
              <Button variant="primary" type="button">
                목록으로 돌아가기
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const updateEntry = (creatorId: string, patch: Partial<CampaignEntry>) => {
    const nextEntries = campaign.entries.map((e) =>
      e.creatorId === creatorId ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e,
    );
    upsertCampaign({ ...campaign, entries: nextEntries });
  };

  const addToPipeline = (creatorId: string) => {
    if (pipelineCreatorIds.has(creatorId)) return;
    const entry: CampaignEntry = {
      creatorId,
      stage: "candidate",
      updatedAt: new Date().toISOString(),
    };
    upsertCampaign({ ...campaign, entries: [...campaign.entries, entry] });
  };

  const settleWithPerformance = (creatorId: string, perf?: CreatorPerformance) => {
    updateEntry(creatorId, { stage: "settled", paidAt: new Date().toISOString(), performance: perf });
    if (perf) {
      const creator = creators.find((c) => c.id === creatorId);
      if (creator) upsertCreator(applyPerformanceToHistory(creator, campaign.id, perf));
    }
  };

  const handleStageChange = (creatorId: string, stage: CampaignStage) => {
    if (stage === "settled") {
      const entry = entries.find((e) => e.creatorId === creatorId);
      if (!entry?.performance) {
        setModal({ kind: "settle-confirm", creatorId });
        return;
      }
      settleWithPerformance(creatorId, entry.performance);
      showToast("정산 완료로 표시했어요.");
      return;
    }
    updateEntry(creatorId, { stage });
  };

  const runOutreach = async (creatorId: string) => {
    const creator = creators.find((c) => c.id === creatorId);
    if (!creator) return;
    setOutreachLoading(true);
    setOutreachError(null);
    try {
      const res = await fetch("/api/creators/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: { name: brandProfile?.name || "우리 브랜드", description: brandProfile?.brandDescription },
          creator: { handle: creator.handle, category: creator.category, platform: creator.platform },
          campaign: { name: campaign.name, goal: campaign.goal, product: campaign.productId },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성에 실패했어요.");
      setOutreachDraft(data.message);
    } catch (e) {
      setOutreachError(e instanceof Error ? e.message : "생성에 실패했어요.");
    } finally {
      setOutreachLoading(false);
    }
  };

  const runGuideline = async (creatorId: string) => {
    const creator = creators.find((c) => c.id === creatorId);
    if (!creator) return;
    setGuidelineLoading(true);
    setGuidelineError(null);
    try {
      const res = await fetch("/api/creators/content-guideline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: { name: brandProfile?.name || "우리 브랜드", description: brandProfile?.brandDescription },
          campaign: { name: campaign.name, goal: campaign.goal, product: campaign.productId },
          platform: creator.platform,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성에 실패했어요.");
      setGuideline(data);
    } catch (e) {
      setGuidelineError(e instanceof Error ? e.message : "생성에 실패했어요.");
    } finally {
      setGuidelineLoading(false);
    }
  };

  const runInsight = async () => {
    setInsightLoading(true);
    setInsightError(null);
    try {
      const res = await fetch("/api/creators/report-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign: { name: campaign.name, goal: campaign.goal },
          aggregated,
          perCreator: perCreatorRows.map((r) => ({
            handle: r.handle,
            reach: r.reach,
            clicks: r.clicks,
            conversions: r.conversions,
            revenue: r.revenue,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성에 실패했어요.");
      setInsight(data);
    } catch (e) {
      setInsightError(e instanceof Error ? e.message : "생성에 실패했어요.");
    } finally {
      setInsightLoading(false);
    }
  };

  const handleCopyReport = () => {
    const text = serializeInfluencerReportText({
      campaignName: campaign.name,
      aggregated,
      perCreator: perCreatorRows,
      insight,
    });
    navigator.clipboard.writeText(text);
    showToast("리포트를 복사했어요.");
  };

  const handleExportCsv = () => {
    const csv = toInfluencerCampaignCsv(perCreatorRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${campaign.name}_리포트.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modalCreator = modal ? creators.find((c) => c.id === modal.creatorId) : null;
  const modalEntry = modal ? entries.find((e) => e.creatorId === modal.creatorId) : null;

  return (
    <div className="w-full max-w-[1080px] mx-auto px-12 py-10 pb-24 flex flex-col gap-6" data-screen-label="캠페인 파이프라인 허브">
      <header>
        <Link href="/creators/campaigns" className="font-semibold text-[13px] text-[var(--w-fg-neutral)] no-underline">
          인플루언서 캠페인
        </Link>
        <h1 className="m-0 mt-1.5 font-bold text-[27px] leading-[1.2] tracking-[-0.02em] text-[var(--w-fg-strong)]">
          {campaign.name}
        </h1>
        <p className="mt-2 mb-0 font-medium text-[14px] leading-[1.55] text-[var(--w-fg-neutral)]">{campaign.goal}</p>
      </header>

      {creators.length === 0 ? (
        <RankingEmptyState />
      ) : (
        <RankingPanel results={rankResults} hasAnyHistory={hasAnyHistory} onAdd={addToPipeline} />
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="m-0 font-bold text-[16px] leading-[1.3] text-[var(--w-fg-strong)]">파이프라인</h2>
        {entries.length === 0 ? (
          <p className="m-0 font-medium text-[13.5px] leading-[1.5] text-[var(--w-fg-neutral)]">
            위 랭킹에서 크리에이터를 담으면 여기서 단계별로 관리할 수 있어요.
          </p>
        ) : (
          <PipelineBoard
            entries={entries}
            creators={creators}
            onStageChange={handleStageChange}
            onOutreach={(creatorId) => {
              const entry = entries.find((e) => e.creatorId === creatorId);
              setOutreachDraft(entry?.outreachDraft ?? "");
              setOutreachError(null);
              setModal({ kind: "outreach", creatorId });
            }}
            onGuideline={(creatorId) => {
              setGuideline(null);
              setGuidelineError(null);
              setModal({ kind: "guideline", creatorId });
            }}
            onPerformance={(creatorId) => setModal({ kind: "performance", creatorId })}
          />
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="m-0 font-bold text-[16px] leading-[1.3] text-[var(--w-fg-strong)]">성과 &amp; 리포트</h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={handleCopyReport}>
              <Icon name="copy" size={14} /> 복사
            </Button>
            <Button variant="secondary" size="sm" type="button" onClick={handleExportCsv}>
              <Icon name="doc" size={14} /> CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-[var(--w-bg-alternative)] px-3.5 py-3">
            <div className="font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">도달</div>
            <div className="font-bold text-[17px] leading-[1.4] text-[var(--w-fg-strong)] mt-1">
              {aggregated.reach.toLocaleString("ko-KR")}
            </div>
          </div>
          <div className="rounded-xl bg-[var(--w-bg-alternative)] px-3.5 py-3">
            <div className="font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">클릭</div>
            <div className="font-bold text-[17px] leading-[1.4] text-[var(--w-fg-strong)] mt-1">
              {aggregated.clicks.toLocaleString("ko-KR")}
            </div>
          </div>
          <div className="rounded-xl bg-[var(--w-bg-alternative)] px-3.5 py-3">
            <div className="font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">전환</div>
            <div className="font-bold text-[17px] leading-[1.4] text-[var(--w-fg-strong)] mt-1">
              {aggregated.conversions.toLocaleString("ko-KR")}
            </div>
          </div>
          <div className="rounded-xl bg-[var(--w-bg-alternative)] px-3.5 py-3">
            <div className="font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">ROAS</div>
            <div className="font-bold text-[17px] leading-[1.4] text-[var(--w-fg-strong)] mt-1">
              {aggregated.roas != null ? `${aggregated.roas.toFixed(2)}x` : "미표시"}
            </div>
          </div>
        </div>

        {perCreatorRows.length === 0 ? (
          <p className="m-0 font-medium text-[13.5px] leading-[1.5] text-[var(--w-fg-neutral)]">
            성과가 입력된 크리에이터가 아직 없어요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--w-line-normal)]">
                  {["핸들", "단계", "도달", "클릭", "전환", "매출"].map((h) => (
                    <th key={h} className="text-left font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)] py-2 pr-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perCreatorRows.map((row) => (
                  <tr key={row.handle} className="border-b border-[var(--w-line-alternative)] last:border-0">
                    <td className="font-semibold text-[13px] text-[var(--w-fg-strong)] py-2.5 pr-3">{row.handle}</td>
                    <td className="font-medium text-[13px] text-[var(--w-fg-neutral)] py-2.5 pr-3">{row.stage}</td>
                    <td className="font-medium text-[13px] text-[var(--w-fg-normal)] py-2.5 pr-3">
                      {row.reach?.toLocaleString("ko-KR") ?? "-"}
                    </td>
                    <td className="font-medium text-[13px] text-[var(--w-fg-normal)] py-2.5 pr-3">
                      {row.clicks?.toLocaleString("ko-KR") ?? "-"}
                    </td>
                    <td className="font-medium text-[13px] text-[var(--w-fg-normal)] py-2.5 pr-3">
                      {row.conversions?.toLocaleString("ko-KR") ?? "-"}
                    </td>
                    <td className="font-medium text-[13px] text-[var(--w-fg-normal)] py-2.5 pr-3">
                      {row.revenue != null ? `₩${row.revenue.toLocaleString("ko-KR")}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-[var(--w-line-alternative)] pt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              {insight && (
                <span className="font-medium text-[11px] leading-none text-[var(--w-fg-alternative)]">
                  AI 요약이에요 — 숫자는 입력한 실측값 그대로예요.
                </span>
              )}
            </div>
            <Button variant="secondary" size="sm" type="button" onClick={runInsight} disabled={insightLoading}>
              <Icon name="sparkles" size={14} spin={insightLoading} /> 리포트 인사이트 만들기
            </Button>
          </div>
          {insightError && (
            <p className="m-0 font-medium text-[13px] text-[var(--w-status-negative)]">{insightError}</p>
          )}
          {insight && (
            <div className="flex flex-col gap-2 rounded-xl bg-[var(--w-bg-alternative)] px-4 py-3.5">
              <div className="font-bold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]">{insight.headline}</div>
              <ul className="m-0 pl-[18px] font-medium text-[13px] leading-[1.6] text-[var(--w-fg-normal)]">
                {insight.insights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      {modal?.kind === "outreach" && modalCreator && (
        <OutreachDraftModal
          creatorHandle={modalCreator.handle}
          initialDraft={outreachDraft}
          loading={outreachLoading}
          error={outreachError}
          onClose={() => setModal(null)}
          onGenerate={() => runOutreach(modal.creatorId)}
          onSave={(draft) => {
            updateEntry(modal.creatorId, { outreachDraft: draft });
            setModal(null);
            showToast("제안 초안을 저장했어요.");
          }}
        />
      )}

      {modal?.kind === "guideline" && modalCreator && (
        <ContentGuidelineModal
          creatorHandle={modalCreator.handle}
          guideline={guideline}
          loading={guidelineLoading}
          error={guidelineError}
          onClose={() => {
            if (guideline) updateEntry(modal.creatorId, { contentGuideline: JSON.stringify(guideline) });
            setModal(null);
          }}
          onGenerate={() => runGuideline(modal.creatorId)}
        />
      )}

      {modal?.kind === "performance" && modalCreator && (
        <PerformanceInputModal
          creatorHandle={modalCreator.handle}
          initialPerformance={modalEntry?.performance}
          onClose={() => setModal(null)}
          onSave={(perf) => {
            const performance: CreatorPerformance = {
              campaignId: campaign.id,
              ...perf,
              recordedAt: new Date().toISOString(),
            };
            if (modal.settleAfterSave) {
              settleWithPerformance(modal.creatorId, performance);
              showToast("정산 완료로 표시했어요.");
            } else {
              updateEntry(modal.creatorId, { performance });
              if (modalEntry?.stage === "settled") {
                const creator = creators.find((c) => c.id === modal.creatorId);
                if (creator) upsertCreator(applyPerformanceToHistory(creator, campaign.id, performance));
              }
              showToast("성과를 저장했어요.");
            }
            setModal(null);
          }}
        />
      )}

      {modal?.kind === "settle-confirm" && modalCreator && (
        <SettleConfirmModal
          creatorHandle={modalCreator.handle}
          onClose={() => setModal(null)}
          onInputPerformance={() => setModal({ kind: "performance", creatorId: modal.creatorId, settleAfterSave: true })}
          onSkip={() => {
            settleWithPerformance(modal.creatorId, undefined);
            setModal(null);
            showToast("정산 완료로 표시했어요.");
          }}
        />
      )}
    </div>
  );
}
