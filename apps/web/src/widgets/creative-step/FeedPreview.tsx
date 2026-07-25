"use client";

// PRD-create-flow-redesign §3.2 — 스튜디오 좌측 sticky 피드 프리뷰. 카피·이미지 선택이 즉시 반영되는
// 시선 앵커. IgPostPreview(shared) 를 그대로 감싼다 — 렌더 로직 신규 구현 없음.

import { useSession } from "next-auth/react";
import { CTAS } from "@entities/creative/options";
import { useCreativeDraft } from "@entities/creative/model";
import { useLaunchDraft } from "@entities/campaign/model";
import { IgPostPreview } from "@shared/ui/IgPostPreview";
import { BROWSE_IG_ACCOUNT } from "@shared/lib/browse-connection";

export default function FeedPreview() {
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;
  const creative = useCreativeDraft();
  const launch = useLaunchDraft();

  const imageDataUrl = launch.state.finalImageDataUrl ?? launch.state.imageDataUrl ?? "";
  const ctaLabel = CTAS.find((c) => c.id === creative.state.cta)?.label ?? creative.state.cta;
  const handle = browseMode ? BROWSE_IG_ACCOUNT.username : session?.igUsername ?? "my_brand";
  const profilePicture = browseMode ? BROWSE_IG_ACCOUNT.profilePicture : undefined;

  return (
    <div style={{ position: "sticky", top: 20 }}>
      <IgPostPreview
        imageUrl={imageDataUrl}
        caption={creative.state.primaryText}
        handle={handle}
        profilePicture={profilePicture}
        headline={creative.state.headline || undefined}
        sponsored
        ctaLabel={ctaLabel}
      />
    </div>
  );
}
