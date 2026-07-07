"use client";

// PRD-create-flow-redesign §3.3 — 게재 계획서 우측 sticky 게재 카드.
// 게재 상태 토글·계정/소재/URL 경고·mutation 에러·게재 버튼을 한 자리에 묶는다.

import { useSession } from "next-auth/react";
import { useLaunchDraft } from "@entities/campaign/model";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { cn } from "@shared/lib/cn";

interface MutationState {
  isPending: boolean;
  isError: boolean;
  error: { message: string } | null;
}

interface Props {
  canLaunch: boolean;
  canSkipLaunch: boolean;
  onLaunch: () => void;
  onSkipLaunch: () => void;
  mutation: MutationState;
  goSettings: () => void;
  devModeOn: boolean;
  testAccountActive: boolean;
  blockReason: string | null;
}

export default function ConfirmStep({
  canLaunch, canSkipLaunch, onLaunch, onSkipLaunch,
  mutation, goSettings, devModeOn, testAccountActive, blockReason,
}: Props) {
  const { data: session } = useSession();
  const { state, dispatch } = useLaunchDraft();

  const accountConnected = !!(session?.adAccountId && session?.pageId);
  const browseMode = !!session?.browseMode;

  return (
    <Card>
      <div className="font-semibold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)]" style={{ marginBottom: 6 }}>
        게재 상태
      </div>
      <div className="inline-flex gap-0.5 p-[3px] bg-[var(--w-bg-alternative)] rounded-[10px]" style={{ marginTop: 4 }}>
        <button
          type="button"
          className={cn(
            "border-none bg-transparent px-[14px] py-2 rounded-[8px] font-semibold text-[13px] leading-none cursor-pointer transition-[background,color] duration-[120ms]",
            state.delivery === "PAUSED"
              ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]"
              : "text-[var(--w-fg-neutral)]"
          )}
          onClick={() => dispatch({ type: "SET_DELIVERY", value: "PAUSED" })}
        >
          일시중지로 생성
        </button>
        <button
          type="button"
          className={cn(
            "border-none bg-transparent px-[14px] py-2 rounded-[8px] font-semibold text-[13px] leading-none cursor-pointer transition-[background,color] duration-[120ms]",
            state.delivery === "ACTIVE"
              ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]"
              : "text-[var(--w-fg-neutral)]"
          )}
          onClick={() => dispatch({ type: "SET_DELIVERY", value: "ACTIVE" })}
        >
          지금 바로 게재
        </button>
      </div>
      {state.delivery === "ACTIVE" && (
        <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-status-cautionary)] flex gap-1.5 items-center" style={{ marginTop: 10 }}>
          <Icon name="warn" size={14} />
          게재 즉시 Meta 정책 검토에 들어가요. 검토 통과 후 자동으로 노출과 광고비가 시작돼요.
        </div>
      )}

      <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />

      {!accountConnected && !browseMode && (
        <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-status-cautionary)] flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 12 }}>
          <Icon name="warn" size={14} /> 광고 계정·페이지가 연결되지 않아 집행할 수 없어요.
          <Button variant="ghost" size="sm" type="button" onClick={goSettings}>계정 연결하러 가기 →</Button>
        </div>
      )}
      {session?.pixelId && (
        <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)] flex items-center gap-1.5" style={{ marginBottom: 12, color: "var(--w-primary-press)" }}>
          <Icon name="check" size={13} strokeWidth={3} /> Pixel 추적 중 — {session.pixelName ?? session.pixelId}
        </div>
      )}
      {mutation.isError && (
        <div className="flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] border bg-[rgba(255,66,66,0.08)] border-[rgba(255,66,66,0.20)] text-[var(--w-status-negative)]" style={{ marginBottom: 12 }}>
          <Icon name="warn" size={16} />
          <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)" }}>{mutation.error?.message}</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 8, marginTop: 8 }}>
        <Button variant="primary" size="lg" type="button" disabled={!canLaunch} onClick={onLaunch}>
          {mutation.isPending ? (
            <><div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite]" style={{ width: 16, height: 16 }} /> Meta에 전송 중…</>
          ) : browseMode ? (
            state.delivery === "ACTIVE" ? "Meta에 광고 게재하기" : "Meta에 광고 등록하기"
          ) : (
            <><Icon name="megaphone" size={16} /> {state.delivery === "ACTIVE" ? "Meta에 광고 게재하기" : "Meta에 광고 등록하기 (일시중지)"}</>
          )}
        </Button>
        {blockReason ? (
          <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-status-cautionary)] text-center">
            {blockReason}
          </span>
        ) : (
          <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)] text-center inline-flex items-center justify-center gap-1">
            <Icon name="info" size={13} /> Meta 광고 정책 검토는 자동 진행돼요
          </span>
        )}
      </div>

      {devModeOn && !testAccountActive && (
        <Card style={{ marginTop: 24, padding: 16, borderStyle: "dashed", background: "var(--w-bg-alternative)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Icon name="info" size={14} />
            <span style={{ font: "600 13px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>Meta App 개발 모드 전용</span>
          </div>
          <p style={{ font: "500 12.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-normal)", margin: "0 0 12px" }}>
            개발 모드 앱에선 광고 크리에이티브 생성이 막혀요 (subcode 1885183).
            Ad Creative · Ad 단계를 건너뛰고 <strong>캠페인 + 광고 세트까지만</strong> 만들어요. PAUSED 상태로 고정돼요.
            <br />
            <span style={{ color: "var(--w-fg-neutral)" }}>
              💡 전체 플로우 검증은 <code>NEXT_PUBLIC_META_TEST_AD_ACCOUNT_ID</code> 셋팅으로 가능해요.
            </span>
          </p>
          <Button variant="secondary" size="sm" type="button" disabled={!canSkipLaunch} onClick={onSkipLaunch}>
            {mutation.isPending ? (
              <><div className="rounded-full border-[2px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite]" style={{ width: 12, height: 12 }} /> 전송 중…</>
            ) : (
              <>캠페인 + 세트만 생성 (광고 없이)</>
            )}
          </Button>
        </Card>
      )}
    </Card>
  );
}
