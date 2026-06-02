"use client";

// 플로(Flo) 본진 — 활성 광고 계정 횡단 진단 (ADR-045). on-demand 생성 + 캐시 표시.
// 브랜드 컨텍스트는 localStorage 에서 읽어 POST 바디로 주입(서버는 광고·오가닉·토너먼트만 수집).

import { useEffect, useState } from "react";
import { Button } from "@shared/ui/Button";
import { Select } from "@shared/ui/Select";
import { Card } from "@shared/ui/Card";
import { timeAgo } from "@shared/lib/format";
import { readActiveBrandProfileEntry } from "@features/brand-profile/model/useBrandProfileStorage";
import { FloBriefingView } from "@widgets/flo-briefing";
import type { Briefing, FloBrandFact, FloModel } from "@/lib/flo/types";

const MODEL_OPTIONS = [
  { value: "sonnet", label: "빠른 분석 (Claude Sonnet)" },
  { value: "opus", label: "깊은 분석 (Claude Opus)" },
  { value: "gemini", label: "Gemini (빠름)" },
];

function brandFact(): FloBrandFact | undefined {
  const e = readActiveBrandProfileEntry();
  if (!e) return undefined;
  return {
    name: e.name,
    tone: e.tone,
    brandVoice: e.brandVoice,
    brandDescription: e.brandDescription,
    proofPoints: e.proofPoints,
  };
}

export default function FloPage() {
  const [model, setModel] = useState<FloModel>("sonnet");
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedCache, setLoadedCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/flo/briefings")
      .then((r) => (r.ok ? r.json() : { briefing: null }))
      .then((d) => {
        if (!alive) return;
        if (d.briefing) {
          setBriefing(d.briefing);
          setModel(d.briefing.model);
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoadedCache(true));
    return () => {
      alive = false;
    };
  }, []);

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/flo/briefings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, brand: brandFact() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "분석에 실패했어요. 잠시 후 다시 시도해주세요.");
      setBriefing(data.briefing);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석에 실패했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-12 py-9 pb-16 max-w-[920px] w-full mx-auto flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[26px] leading-none">🌊</span>
          <h1 className="text-[24px] font-bold tracking-[-0.01em] text-[var(--w-fg-strong)]">플로</h1>
        </div>
        <p className="text-[14px] text-[var(--w-fg-neutral)]">
          광고 성과·오가닉·A/B 테스트를 한데 모아, 지금 무엇을 할지 진단해드려요.
        </p>
      </header>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-[200px]">
          <Select value={model} onChange={(v) => setModel(v as FloModel)} options={MODEL_OPTIONS} />
        </div>
        <Button variant="primary" onClick={analyze} disabled={loading}>
          {loading ? "분석 중…" : briefing ? "다시 분석" : "분석하기"}
        </Button>
        {briefing && !loading && (
          <span className="text-[12.5px] text-[var(--w-fg-alternative)]">
            마지막 분석 {timeAgo(new Date(briefing.createdAt).getTime())}
          </span>
        )}
      </div>

      {error && (
        <Card className="border-[rgba(255,66,66,0.35)] text-[13.5px] text-[#c52d2d]">{error}</Card>
      )}

      {briefing ? (
        <FloBriefingView briefing={briefing} />
      ) : (
        loadedCache &&
        !loading && (
          <Card variant="quiet" className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="text-[28px]">🌊</span>
            <p className="text-[15px] font-semibold text-[var(--w-fg-strong)]">아직 진단이 없어요</p>
            <p className="text-[13.5px] text-[var(--w-fg-neutral)]">
              "분석하기"를 누르면 플로가 계정 전체를 살펴보고 다음 할 일을 알려드려요.
            </p>
          </Card>
        )
      )}
    </div>
  );
}
