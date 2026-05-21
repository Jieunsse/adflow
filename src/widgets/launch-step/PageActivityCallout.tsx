"use client";

// PRD-objective-aware-launch §3 — engagement_page_likes 고유 섹션.
// 페이지 최근 게시물 7일 내 없으면 경고 (휴면 페이지로 좋아요 광고 → CTR 처참 가드).
// V1 = callout 만, 실 활성도 체크는 PR 3 (launch-validation) 에서 도입.

import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import SubHead from "./SubHead";

export default function PageActivityCallout() {
  const { data: session } = useSession();
  const pageName = session?.pageName;

  return (
    <>
      <SubHead title="페이지 활성도 확인" subtitle="좋아요 광고는 활성 페이지일 때 효율적이에요. 최근 7일 내 게시물이 있는지 점검해주세요." />
      <div className="callout callout--info" style={{ marginBottom: 4 }}>
        <Icon name="info" size={16} />
        <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)" }}>
          {pageName ? <><strong>{pageName}</strong> 페이지에 </> : "활성 페이지에 "}
          최근 게시물이 없으면 광고 클릭 후 사용자가 빠르게 이탈해요. 좋아요 광고 집행 전에 최근 콘텐츠를 1개 이상 올려두는 걸 권장해요.
        </div>
      </div>
    </>
  );
}
