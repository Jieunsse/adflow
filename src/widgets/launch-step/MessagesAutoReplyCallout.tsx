"use client";

// PRD-objective-aware-launch §3·§2.2 — engagement_messages 고유 섹션.
// V1 = 외부 안내 callout 만 (Meta 비즈니스 스위트 deeplink). 자동응답 풀 UI 는 V3+.

import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import SubHead from "./SubHead";

export default function MessagesAutoReplyCallout() {
  const { data: session } = useSession();
  const pageId = session?.pageId;
  const deeplink = pageId
    ? `https://business.facebook.com/latest/inbox/automated_responses?page_id=${pageId}`
    : "https://business.facebook.com/latest/inbox/automated_responses";

  return (
    <>
      <SubHead title="메시지 자동응답 설정" subtitle="광고를 본 사람이 메시지를 보내면 자동응답이 먼저 답해요. 미설정 시 첫 응답이 늦어 이탈률이 높아져요." />
      <div className="callout callout--info" style={{ marginBottom: 4 }}>
        <Icon name="info" size={16} />
        <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)" }}>
          Meta 비즈니스 스위트에서 자동응답·환영 메시지를 미리 설정해두세요.
          <br />
          <a
            href={deeplink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--w-accent-violet)", font: "600 12.5px/1.5 var(--w-font-sans)", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4 }}
          >
            자동응답 설정으로 가기 <Icon name="arrow-right" size={11} />
          </a>
        </div>
      </div>
    </>
  );
}
