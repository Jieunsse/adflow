"use client";

// ADR-062 — 맞춤 타겟 프리셋 3종. disabled 셀렉트 + 죽은 lookalike 체크박스(거짓 약속) 소생.
// 프리셋 생성은 선택 시점(게재 트랜잭션 밖) — 실패를 그 자리에서 표시. 멱등 = list-before-create.

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select } from "@shared/ui/Select";
import { Button } from "@shared/ui/Button";
import { cn } from "@shared/lib/cn";
import { useLaunchDraft } from "@entities/campaign/model";
import { AUDIENCE_PRESETS } from "@entities/custom-audience/presets";
import type { AudiencePresetId, CustomAudienceSummary } from "@entities/custom-audience/types";
import type { PresetStatus } from "@/app/api/audiences/route";
import SubHead from "./SubHead";

type AudiencesResponse = { audiences: CustomAudienceSummary[]; presets: PresetStatus[] };

const chipBase = "inline-flex items-center gap-1.5 px-[14px] py-2 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-none text-[var(--w-fg-strong)] cursor-pointer transition-[background,border-color,color] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50";

function formatSize(a: CustomAudienceSummary): string {
  if (a.approximateCountLowerBound == null || a.approximateCountUpperBound == null) return "집계 중";
  const lower = a.approximateCountLowerBound.toLocaleString("ko-KR");
  const upper = a.approximateCountUpperBound.toLocaleString("ko-KR");
  return `${lower}~${upper}명${a.isExample ? " (예시)" : ""}`;
}

export default function AudienceKnob() {
  const { data: session } = useSession();
  const { state, dispatch } = useLaunchDraft();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState<AudiencePresetId | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{ message: string; tosAcceptUrl?: string } | null>(null);

  const { data } = useQuery({
    queryKey: ["custom-audiences"],
    queryFn: async (): Promise<AudiencesResponse> => {
      const res = await fetch("/api/audiences");
      if (!res.ok) throw new Error("맞춤 타겟을 불러오지 못했어요");
      return res.json();
    },
  });

  const audiences = data?.audiences ?? [];
  const presets = data?.presets ?? [];
  const selected = audiences.find((a) => a.id === state.customAudienceId);

  async function handleCreate(presetId: AudiencePresetId) {
    setErrorState(null);
    setCreating(presetId);
    try {
      const res = await fetch("/api/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset: presetId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErrorState({ message: body.error ?? "맞춤 타겟을 만들지 못했어요.", tosAcceptUrl: body.tosAcceptUrl });
        return;
      }
      const audience = body.audience as CustomAudienceSummary;
      await queryClient.invalidateQueries({ queryKey: ["custom-audiences"] });
      dispatch({ type: "SET_CUSTOM_AUDIENCE", value: audience.id });
      setJustCreatedId(audience.id);
    } catch {
      setErrorState({ message: "맞춤 타겟을 만들지 못했어요. 잠시 후 다시 시도해주세요." });
    } finally {
      setCreating(null);
    }
  }

  return (
    <>
      <SubHead title="맞춤 타겟" subtitle="예전에 반응·방문·구매한 사람들에게 다시 보여줘요." />

      <Select
        value={state.customAudienceId ?? ""}
        onChange={(value) => dispatch({ type: "SET_CUSTOM_AUDIENCE", value: value || null })}
        placeholder="아직 없어요"
        options={audiences.map((a) => ({ value: a.id, label: `${a.name} · ${formatSize(a)}` }))}
      />

      {selected && (
        <p className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-neutral)] mt-2 mb-0">
          페르소나 연령·성별 조건과 겹치는 사람에게만 나가요.
        </p>
      )}

      {justCreatedId === state.customAudienceId && selected && (
        <p className="font-medium text-[12px] leading-[1.5] text-[var(--w-status-cautionary)] mt-1.5 mb-0">
          타겟이 채워지는 중이에요 — 게재 초반 도달이 제한될 수 있어요.
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {presets.map((preset) => {
          const def = AUDIENCE_PRESETS.find((p) => p.id === preset.id)!;
          const disabled = preset.pixelGated || creating !== null;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              className={cn(chipBase)}
              onClick={() => handleCreate(preset.id)}
            >
              {creating === preset.id ? "만드는 중…" : `${def.label} 만들기`}
            </button>
          );
        })}
      </div>
      {presets.some((p) => p.pixelGated) && (
        <p className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-neutral)] mt-2 mb-0">
          픽셀 연결이 필요해요.
        </p>
      )}

      {errorState && (
        <div className="mt-3 px-3 py-2.5 rounded-xl bg-[var(--w-status-negative-soft)]">
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-status-negative)] m-0">
            {errorState.message}
          </p>
          {errorState.tosAcceptUrl && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => window.open(errorState.tosAcceptUrl, "_blank")}
            >
              Ads Manager 에서 약관 수락하기
            </Button>
          )}
        </div>
      )}
    </>
  );
}
