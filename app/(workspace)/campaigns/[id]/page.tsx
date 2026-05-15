"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Icon, { type IconName } from "@shared/ui/Icon";
import { KpiCard } from "@shared/ui/primitives";
import DualChart, { ChartLegend } from "@shared/ui/DualChart";
import { fmt, fmtKRW, shortDate, campaignDateInfo, campaignGradient } from "@shared/lib/format";
import { useApiMutation } from "@shared/lib/api/useApiMutation";
import { useToast } from "@shared/ui/Toast";
import { suggestOptimizations, assessAutomationReadiness, type Suggestion } from "@entities/insights/optimization";
import type { CampaignSummary, InsightsPeriod } from "@/lib/meta-ads";


type Period = "all" | InsightsPeriod;
type Insights = { impressions: number; clicks: number; ctr: number; spend: number; daily: { date: string; clicks: number; ctr: number; spend: number }[] };
type ControlParams = { campaignId: string; adSetId?: string; adId?: string; action: "pause" | "resume" | "set-daily-budget"; dailyBudget?: number };
type ControlResult = { ok: true };

const STATUS_CHIP: Record<string, { label: string; chip: string }> = {
  live: { label: "게재 중", chip: "live" }, review: { label: "검토 중", chip: "review" },
  paused: { label: "일시정지", chip: "paused" }, ended: { label: "종료", chip: "ended" }, issue: { label: "문제 있음", chip: "issue" },
};

async function fetchJson<T>(url: string, notFoundIs401Msg = "광고 계정을 먼저 연결해주세요."): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (res.status === 401) throw Object.assign(new Error(data?.error ?? notFoundIs401Msg), { code: 401 });
  if (!res.ok) throw new Error(data?.error ?? "불러오지 못했어요");
  return data as T;
}

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const showToast = useToast();

  const initialPeriod = (searchParams.get("period") ?? "all") as Period;
  const [period, setPeriod] = useState<Period>(initialPeriod === "7d" || initialPeriod === "30d" ? initialPeriod : "all");

  const metaQ = useQuery({ queryKey: ["campaign-meta", id], queryFn: () => fetchJson<{ campaign: CampaignSummary }>(`/api/campaign/${id}`).then((d) => d.campaign) });
  const insQ = useQuery({ queryKey: ["insights", id, period], queryFn: () => fetchJson<Insights>(`/api/insights/${id}?period=${period}`) });
  const control = useApiMutation<ControlParams, ControlResult>("/api/campaign/control");

  const c = metaQ.data;
  const metaUnauthorized = (metaQ.error as { code?: number } | null)?.code === 401;

  const applyControl = (p: Omit<ControlParams, "campaignId">, msg: string) => {
    control.mutate({ campaignId: id, ...p }, {
      onSuccess: () => { showToast(msg); metaQ.refetch(); insQ.refetch(); },
      onError: (e) => showToast(e instanceof Error ? e.message : "적용에 실패했어요"),
    });
  };

  const { daysLine, progressLine } = campaignDateInfo(c?.startDate ?? null, c?.endDate ?? null, c?.status ?? "");
  const adsManagerUrl = session?.adAccountId
    ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${session.adAccountId.replace(/^act_/, "")}&selected_campaign_ids=${id}`
    : "https://adsmanager.facebook.com/";

  return (
    <div className="page" data-screen-label="캠페인 상세">
      <button type="button" onClick={() => router.push("/campaigns")} className="btn-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--w-fg-neutral)", marginBottom: 4 }}>
        <Icon name="arrow-left" size={13} /> 캠페인
      </button>

      <div className="page__head" style={{ marginTop: 4 }}>
        <div>
          <h1 className="page__title" style={{ marginTop: 0 }}>{c?.headline ?? "캠페인"}</h1>
          <p className="page__sub">{c?.name ?? id}</p>
        </div>
        <div style={{ display: "inline-flex", gap: 8 }}>
          <button className="btn btn--secondary" type="button" onClick={() => insQ.refetch()} disabled={insQ.isFetching}>
            <Icon name="refresh" size={14} /> {insQ.isFetching ? "불러오는 중…" : "성과 새로고침"}
          </button>
        </div>
      </div>

      {metaUnauthorized ? (
        <DetailErrorCard icon="link" title="광고 계정을 먼저 연결해주세요" reason="Meta 광고 계정과 페이지를 연결해야 캠페인을 볼 수 있어요." ctaLabel="계정 연결로 가기" onAction={() => router.push("/setup")} />
      ) : metaQ.isError ? (
        <DetailErrorCard title="캠페인 정보를 불러오지 못했어요" reason={metaQ.error instanceof Error ? metaQ.error.message : "잠시 후 다시 시도해 주세요"} ctaLabel="다시 시도" onAction={() => metaQ.refetch()} />
      ) : (
        <>
          <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: "1 1 360px" }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: campaignGradient(id), flex: "0 0 auto" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  {c ? (
                    <span className={`chip chip--${STATUS_CHIP[c.status]?.chip ?? "neutral"}`}><span className="chip__dot" />{STATUS_CHIP[c.status]?.label ?? c.status}</span>
                  ) : (
                    <span className="skel" style={{ height: 22, width: 70, borderRadius: 999 }} />
                  )}
                  <span className="chip chip--neutral" style={{ font: "500 11.5px/1 var(--w-font-mono)" }}>Campaign ID · {id.slice(-10)}</span>
                </div>
                <div style={{ font: "500 12.5px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>{daysLine} · {progressLine}</div>
              </div>
            </div>
            <div className="seg">
              <button type="button" className={period === "all" ? "on" : ""} onClick={() => setPeriod("all")}>전체</button>
              <button type="button" className={period === "7d" ? "on" : ""} onClick={() => setPeriod("7d")}>최근 7일</button>
              <button type="button" className={period === "30d" ? "on" : ""} onClick={() => setPeriod("30d")}>최근 30일</button>
            </div>
          </div>

          {metaQ.isLoading || insQ.isLoading ? (
            <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 32px" }}>
              <div className="spinner" style={{ width: 28, height: 28 }} />
              <div style={{ font: "600 14px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>성과를 불러오는 중…</div>
            </div>
          ) : insQ.isError ? (
            <DetailErrorCard title="성과를 불러오지 못했어요" reason={insQ.error instanceof Error ? insQ.error.message : "Meta API 응답 오류 — 잠시 후 다시 시도해 주세요"} ctaLabel="다시 시도" onAction={() => insQ.refetch()} />
          ) : !c ? null : c.status === "review" || !insQ.data || insQ.data.daily.length === 0 ? (
            <div className="card" style={{ padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--w-primary-soft)", color: "var(--w-primary-press)", display: "grid", placeItems: "center" }}><Icon name="clock" size={24} /></div>
              <div style={{ font: "700 17px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>아직 성과 데이터가 없어요</div>
              <div style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", maxWidth: 400, lineHeight: 1.7 }}>
                Meta가 광고를 검토·집계 준비 중이에요. 심사를 통과해 게재가 시작되고 노출이 쌓이면 여기에 표시돼요.<br />
                <span style={{ color: "var(--w-fg-alternative)" }}>보통 수 분 ~ 수 시간 걸리고, 데이터는 몇 시간 단위로 갱신돼요.</span>
              </div>
              <button className="btn btn--secondary" type="button" onClick={() => insQ.refetch()}><Icon name="refresh" size={14} /> 성과 새로고침</button>
            </div>
          ) : (
            <DetailBody c={c} data={insQ.data} period={period} busy={control.isPending} adsManagerUrl={adsManagerUrl} onApply={applyControl} onRemake={() => router.push("/create")} />
          )}
        </>
      )}
    </div>
  );
}

function DetailBody({
  c, data, busy, adsManagerUrl, onApply, onRemake,
}: {
  c: CampaignSummary; data: Insights; period: Period; busy: boolean; adsManagerUrl: string;
  onApply: (p: Omit<ControlParams, "campaignId">, msg: string) => void; onRemake: () => void;
}) {
  const labels = data.daily.map((x) => shortDate(x.date));
  const clicks = data.daily.map((x) => x.clicks);
  const ctrs = data.daily.map((x) => x.ctr);
  const dailyBudget = c.dailyBudget ?? 50000;
  const isPaused = c.status === "paused";
  const isIssue = c.status === "issue";
  const metrics = { impressions: data.impressions, clicks: data.clicks, ctr: data.ctr, spend: data.spend };
  const suggestions: Suggestion[] = suggestOptimizations(metrics, dailyBudget);
  const readiness = assessAutomationReadiness(metrics, data.daily.length);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 16 }}>
        <KpiCard label="총 노출수" value={fmt(data.impressions)} trend={[120, 145, 162, 180, 175, 210, 225, 240, 268, 254, 285]} />
        <KpiCard label="총 클릭수" value={fmt(data.clicks)} trend={clicks} />
        <KpiCard label="CTR" value={data.ctr.toFixed(2)} suffix="%" trend={ctrs} />
        <KpiCard label="총 지출" value={fmtKRW(data.spend)} trend={data.daily.map((x) => x.spend / 1000)} color="var(--w-accent-violet)" />
      </div>

      {isPaused ? (
        <div className="card" style={{ background: "rgba(255,146,0,0.06)", border: "1px solid rgba(255,146,0,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,146,0,0.15)", color: "var(--w-status-cautionary)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name="pause" size={20} /></div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ font: "700 16px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>이 광고는 일시정지 상태예요</div>
              <div style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>재개하거나 새 소재로 다시 만들어볼 수 있어요. Meta 광고 관리자에서 외부로 상태가 바뀌었다면 새로고침 후 다시 확인해주세요.</div>
            </div>
            <div style={{ display: "inline-flex", gap: 8 }}>
              <button className="btn btn--secondary" type="button" disabled={busy || !c.adSetId} onClick={() => onApply({ adSetId: c.adSetId ?? undefined, adId: c.adId ?? undefined, action: "resume" }, "광고를 재개했어요")}><Icon name="play" size={14} /> {busy ? "처리 중…" : "광고 재개"}</button>
              <button className="btn btn--primary" type="button" onClick={onRemake}><Icon name="sparkles" size={14} /> 새 소재로 다시 만들기</button>
            </div>
          </div>
        </div>
      ) : isIssue ? (
        <div className="card" style={{ background: "rgba(255,66,66,0.06)", border: "1px solid rgba(255,66,66,0.30)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,66,66,0.12)", color: "var(--w-status-negative)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name="warn" size={20} /></div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ font: "700 16px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>이 광고에 문제가 있어요</div>
              <div style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>Meta 광고 관리자에서 사유를 확인하고 조치해 주세요.</div>
            </div>
            <a className="btn btn--secondary" href={adsManagerUrl} target="_blank" rel="noreferrer">Meta 광고 관리자에서 사유 확인 <Icon name="arrow-right" size={14} /></a>
          </div>
        </div>
      ) : (
        <div className="card" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, alignItems: "flex-start" }}>
          <div>
            <h3 className="section-title">최적화 제안</h3>
            <p className="section-sub">제안은 직접 확인 후 적용해요. 자동으로 바뀌지 않아요.</p>
            <hr className="divider" />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {suggestions.length === 0 ? (
                <p className="field__hint">지금은 특별히 권할 조정이 없어요. 데이터가 더 쌓이면 다시 살펴볼게요.</p>
              ) : suggestions.map((s, i) => {
                const warn = s.severity === "warn";
                return (
                  <OptCard key={i} icon={warn ? "warn" : "trend-up"} good={!warn} title={s.title} lines={s.detail}>
                    {s.kind === "pause" && <button className="btn btn--secondary btn--sm" type="button" disabled={busy} onClick={() => onApply({ action: "pause" }, "광고를 일시정지했어요")}>{busy ? "처리 중…" : "광고 일시정지"}</button>}
                    {s.kind === "increase-budget" && <button className="btn btn--secondary btn--sm" type="button" disabled={busy || !c.adSetId} onClick={() => onApply({ adSetId: c.adSetId ?? undefined, action: "set-daily-budget", dailyBudget: s.toDailyBudget }, `일일예산을 ${fmtKRW(s.toDailyBudget)}로 올렸어요`)}>{busy ? "처리 중…" : `${fmtKRW(s.toDailyBudget)}로 올리기`}</button>}
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
                <span className="chip chip--live"><span className="chip__dot" /> 자동화 준비 완료</span>
                <div style={{ font: "700 16px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", marginTop: 10 }}>AI 자동 운영을 켤 수 있어요</div>
                <p style={{ font: "500 13px/1.55 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "8px 0 14px" }}>{readiness.reason}</p>
                <button className="btn btn--primary btn--sm" type="button" disabled title="자동 실행 환경 연동 후 활성화돼요">자동화 켜기 (연동 준비 중)</button>
              </div>
            ) : (
              <div style={{ background: "var(--w-bg-alternative)", borderRadius: 12, padding: 18 }}>
                <span className="chip chip--neutral">아직 지표가 아쉬워요</span>
                <div style={{ font: "700 16px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", marginTop: 10 }}>아직 자동화를 맡기기엔 지표가 아쉬워요</div>
                <p style={{ font: "500 13px/1.55 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "8px 0" }}>부족: {readiness.reason}. 데이터가 더 쌓이면 자동화를 제안해드릴게요.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="between" style={{ marginBottom: 14 }}>
          <div>
            <h3 className="section-title">일별 추이</h3>
            <p className="section-sub">최근 {data.daily.length}일 클릭수와 CTR 변화</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <ChartLegend color="var(--w-primary-normal)" label="클릭수" type="bar" />
            <ChartLegend color="var(--w-accent-violet)" label="CTR" type="line" />
          </div>
        </div>
        <DualChart labels={labels} clicks={clicks} ctrs={ctrs} />
      </div>

      <div className="card" style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px 22px 16px" }}>
          <h3 className="section-title" style={{ marginBottom: 4 }}>일별 상세</h3>
          <p className="section-sub" style={{ marginBottom: 0 }}>날짜별 핵심 지표 · 전일 대비 CTR 변화 포함</p>
        </div>
        <table className="dtable">
          <thead>
            <tr><th>날짜</th><th style={{ textAlign: "right" }}>클릭</th><th style={{ textAlign: "right" }}>CTR</th><th style={{ textAlign: "right" }}>지출</th><th style={{ width: 96, textAlign: "right" }}>전일 대비</th></tr>
          </thead>
          <tbody>
            {data.daily.map((row, i) => {
              const prev = data.daily[i - 1];
              const delta = prev ? row.ctr - prev.ctr : null;
              const up = delta != null && delta > 0;
              const flat = delta != null && Math.abs(delta) < 0.01;
              return (
                <tr key={i} className="dtable__row">
                  <td style={{ font: "600 13px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{shortDate(row.date)}</td>
                  <td className="dtable__num">{fmt(row.clicks)}</td>
                  <td className="dtable__num">{row.ctr.toFixed(2)}%</td>
                  <td className="dtable__num">{fmtKRW(row.spend)}</td>
                  <td className="dtable__num">
                    {delta == null ? <span style={{ color: "var(--w-fg-alternative)" }}>—</span>
                      : flat ? <span style={{ color: "var(--w-fg-neutral)" }}>±0.00%p</span>
                      : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: up ? "var(--w-status-positive)" : "var(--w-status-negative)" }}><Icon name={up ? "trend-up" : "trend-down"} size={12} />{(up ? "+" : "")}{delta.toFixed(2)}%p</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: "12px 22px 18px" }}><span className="field__hint">Meta 인사이트 기준 · 데이터는 몇 시간 단위로 갱신돼요</span></div>
      </div>
    </>
  );
}

function OptCard({ icon, good, title, lines, children }: { icon: IconName; good: boolean; title: string; lines: string[]; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, padding: 14, border: "1px solid var(--w-line-alternative)", borderRadius: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: good ? "rgba(0,191,64,0.10)" : "rgba(255,146,0,0.12)", color: good ? "var(--w-status-positive)" : "var(--w-status-cautionary)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name={icon} size={18} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "600 14px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{title}</div>
        {lines.map((l, j) => <div key={j} style={{ font: "500 12.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>{l}</div>)}
      </div>
      {children && <div style={{ flex: "0 0 auto", alignSelf: "center" }}>{children}</div>}
    </div>
  );
}

function DetailErrorCard({ icon = "warn", title, reason, ctaLabel, onAction }: { icon?: IconName; title: string; reason: string; ctaLabel: string; onAction: () => void }) {
  return (
    <div className="card" style={{ padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,66,66,0.10)", color: "var(--w-status-negative)", display: "grid", placeItems: "center" }}><Icon name={icon} size={24} /></div>
      <div style={{ font: "700 17px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{title}</div>
      <div style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", maxWidth: 380 }}>{reason}</div>
      <button className="btn btn--secondary" type="button" style={{ marginTop: 8 }} onClick={onAction}>{ctaLabel}</button>
    </div>
  );
}
