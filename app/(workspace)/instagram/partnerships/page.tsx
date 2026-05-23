"use client";

import Partnerships from "@widgets/business-portfolio/Partnerships";

export default function InstagramPartnershipsPage() {
  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7">
      <div>
        <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">채널 관리 · Instagram</span>
        <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]">파트너십</h1>
      </div>
      <Partnerships />
    </div>
  );
}
