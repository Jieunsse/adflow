"use client";

// 우측 컬럼 상단 — 집행 mutation 상태에 따라 4갈래 분기:
//   - launched 있음   → 성공 카드(LaunchSuccessCard)
//   - error 있음       → 에러 카드 + 재시도
//   - pending          → 로딩 카드
//   - idle             → "집행 설정 후 버튼을 눌러주세요" 빈 카드

import Icon from "@shared/ui/Icon";
import { useLaunchDraft } from "@entities/campaign/model";
import LaunchSuccessCard from "./LaunchSuccessCard";
import CampaignSkeletonSuccessCard from "./CampaignSkeletonSuccessCard";

// mutation 의 generic 파라미터에 의존하지 않게 — 우리가 쓰는 4 필드만 추려서 받음.
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

  if (launched) {
    return launched.skipped
      ? <CampaignSkeletonSuccessCard />
      : <LaunchSuccessCard onNext={onNext} />;
  }

  if (mutation.isError) {
    return (
      <div
        className="card"
        style={{ borderColor: "var(--w-status-negative)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "28px 20px", textAlign: "center" }}
      >
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,66,66,0.10)", color: "var(--w-status-negative)", display: "grid", placeItems: "center" }}>
          <Icon name="x" size={20} />
        </div>
        <div style={{ font: "700 15px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>집행 중 오류가 발생했어요</div>
        <p style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-normal)", margin: 0 }}>
          {mutation.error?.message ?? "알 수 없는 오류"}
        </p>
        <button className="btn btn--primary btn--sm" type="button" onClick={() => mutation.reset()}>
          다시 시도하기
        </button>
      </div>
    );
  }

  if (mutation.isPending) {
    return (
      <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 20px" }}>
        <div className="spinner" />
        <div style={{ font: "600 14px/1.4 var(--w-font-sans)" }}>Meta에 전송 중…</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ textAlign: "center", padding: "32px 20px" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--w-bg-alternative)", color: "var(--w-fg-neutral)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
        <Icon name="play" size={22} />
      </div>
      <div style={{ font: "600 15px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>집행 설정 후 버튼을 눌러주세요</div>
      <p style={{ font: "500 12.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-normal)", margin: "8px 0 0" }}>
        전송이 완료되면 Campaign / AdSet / Ad ID 가 여기에 표시돼요.
      </p>
    </div>
  );
}
