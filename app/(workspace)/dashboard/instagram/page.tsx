"use client";

import IgInsightsTab from "@widgets/performance-step/IgInsightsTab";

export default function DashboardInstagramPage() {
  return (
    <div className="page" data-screen-label="인스타그램 대시보드">
      <div className="page__head">
        <div>
          <span className="w-overline" style={{ color: "var(--w-fg-neutral)" }}>대시보드 · Instagram</span>
          <h1 className="page__title">인스타그램 대시보드</h1>
          <p className="page__sub">연결된 Instagram 비즈니스 계정의 오가닉 성과와 게시물 인사이트를 확인해요.</p>
        </div>
      </div>

      <IgInsightsTab />
    </div>
  );
}
