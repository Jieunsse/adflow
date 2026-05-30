"use client";

// 우측 컬럼 상단 — 집행 mutation 상태에 따라 4갈래 분기:
//   - launched 있음   → 성공 카드(LaunchSuccessCard)
//   - error 있음       → 에러 카드 + 재시도
//   - pending          → 로딩 카드
//   - idle             → "집행 설정 후 버튼을 눌러주세요" 빈 카드

import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { useLaunchDraft } from "@entities/campaign/model";
import LaunchSuccessCard from "./LaunchSuccessCard";
import CampaignSkeletonSuccessCard from "./CampaignSkeletonSuccessCard";

interface LaunchMutationView {
  isError: boolean;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

interface Props {
  mutation: LaunchMutationView;
  onNext: () => void;
}

export default function LaunchStatusPanel({ mutation, onNext }: Props) {
  const launched = useLaunchDraft().state.launchedCampaign;
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;

  if (launched) {
    return launched.skipped
      ? <CampaignSkeletonSuccessCard />
      : <LaunchSuccessCard onNext={onNext} />;
  }

  if (mutation.isError) {
    return (
      <Card className="border-[var(--w-status-negative)] flex flex-col items-center gap-3 p-[28px_20px] text-center">
        <div className="w-10 h-10 rounded-full bg-[rgba(255,66,66,0.10)] text-[var(--w-status-negative)] grid place-items-center">
          <Icon name="x" size={20} />
        </div>
        <div className="font-bold text-[15px] leading-[1.3] text-[var(--w-fg-strong)]">집행 중 오류가 발생했어요</div>
        <p className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-normal)] m-0">
          {mutation.error?.message ?? "알 수 없는 오류"}
        </p>
        <Button variant="primary" size="sm" type="button" onClick={() => mutation.reset()}>
          다시 시도하기
        </Button>
      </Card>
    );
  }

  if (mutation.isPending) {
    return (
      <Card className="flex flex-col items-center gap-3 p-[32px_20px]">
        <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[18px] h-[18px]" />
        <div className="font-semibold text-[14px] leading-[1.4]">Meta에 전송 중…</div>
      </Card>
    );
  }

  if (browseMode) return null;

  return (
    <Card className="text-center p-[32px_20px]">
      <div className="w-14 h-14 rounded-full bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)] grid place-items-center mx-auto mb-3.5">
        <Icon name="play" size={22} />
      </div>
      <div className="font-semibold text-[15px] leading-[1.4] text-[var(--w-fg-strong)]">집행 설정 후 버튼을 눌러주세요</div>
      <p className="font-medium text-[12.5px] leading-[1.55] text-[var(--w-fg-normal)] mt-2 mb-0">
        전송이 완료되면 Campaign / AdSet / Ad ID 가 여기에 표시돼요.
      </p>
    </Card>
  );
}
