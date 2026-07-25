"use client";

// PRD §13.10 — 선택된 광고 목표 read-only 요약 카드. STEP 01 / STEP 02 양쪽에서 재사용.
// "변경" 버튼은 caller 의 콜백 — STEP 01 에선 outcome=null 로 dispatch (→ intro 복귀),
// STEP 02 에선 STEP 01 으로 navigate. 호출자가 의도 명시.
//
// 텍스트는 label 한 줄 + Meta enum 한 줄. label+outcomeLabel 결합 분기 제거.

import Image from "next/image";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@shared/lib/cn";
import Icon from "@shared/ui/Icon";
import { Card } from "@shared/ui/Card";
import { Button } from "@shared/ui/Button";
import { BROWSE_IG_ACCOUNT } from "@shared/lib/browse-connection";
import { OBJECTIVES_PHASE1, OBJECTIVES_PHASE2 } from "@entities/creative/options";
import { useCreativeDraft } from "@entities/creative/model";

interface Props {
  /** "변경" 버튼 클릭 시 동작. 라벨도 caller 가 정해서 의도 명확화. */
  onChange: () => void;
  /** ghost 버튼 라벨 — 기본 "광고 목표 변경". STEP 02 에선 "STEP 01에서 변경" 같은 컨텍스트 라벨. */
  changeLabel?: string;
}

export default function SelectedGoalCard({ onChange, changeLabel = "광고 목표 변경" }: Props) {
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;
  const creative = useCreativeDraft();
  const outcome = creative.state.outcome;
  const goal = outcome
    ? [...OBJECTIVES_PHASE1, ...OBJECTIVES_PHASE2].find((o) => o.id === outcome) ?? null
    : null;

  const igUsername = browseMode ? BROWSE_IG_ACCOUNT.username : session?.igUsername ?? null;
  const igName = browseMode ? BROWSE_IG_ACCOUNT.name : null;

  const { data: pics } = useQuery({
    queryKey: ["profile-pictures", session?.igUserId],
    queryFn: async () => {
      const res = await fetch("/api/connect/profile-pictures");
      if (!res.ok) return { igPicture: null as string | null };
      return res.json() as Promise<{ igPicture: string | null }>;
    },
    enabled: !browseMode && !!igUsername,
    staleTime: 60 * 60 * 1000,
  });

  const profilePicture = browseMode ? BROWSE_IG_ACCOUNT.profilePicture : pics?.igPicture ?? null;

  return (
    <>
      <Card className={cn("p-[18px] flex items-center gap-4", browseMode ? "mb-2" : "mb-[18px]")}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "var(--w-primary-soft)",
            color: "var(--w-accent-violet)",
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
          }}
        >
          <Icon name={browseMode ? "instagram" : goal?.iconName ?? "target"} size={24} strokeWidth={1.7} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "500 11.5px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginBottom: 6 }}>
            선택한 광고 목표
          </div>
          <div style={{ font: "700 16px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
            {goal ? goal.label : "선택 안 됨"}
          </div>
        </div>
        <Button variant="ghost" size="sm" type="button" onClick={onChange}>
          {changeLabel}
        </Button>
      </Card>
      {igUsername && (
        <Card className="mb-[18px] px-[18px] py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#feda75] via-[#fa7e1e] to-[#d62976] p-[2px] shrink-0">
            <div className="w-full h-full rounded-full bg-[var(--w-bg-elevated)] overflow-hidden grid place-items-center">
              {profilePicture ? (
                <Image
                  src={profilePicture}
                  alt=""
                  width={28}
                  height={28}
                  className="w-full h-full object-cover rounded-full"
                  unoptimized
                />
              ) : (
                <span className="text-[11px] font-bold text-[var(--w-fg-strong)]">
                  {igUsername[0].toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: "600 13.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
              @{igUsername}
            </div>
            {igName && (
              <div style={{ font: "500 11.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
                {igName}
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
