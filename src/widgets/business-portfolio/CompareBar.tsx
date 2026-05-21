"use client";

import Icon from "@shared/ui/Icon";

function fmtK(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export type CompareBarProps = {
  ig: { handle?: string; followers: number; engagementRate: number; mock: boolean };
  fb: { name?: string; followers: number; engagementRate: number; mock: boolean };
  onJumpInstagram: () => void;
  onJumpFacebook: () => void;
};

export default function CompareBar({ ig, fb, onJumpInstagram, onJumpFacebook }: CompareBarProps) {
  const totalFollowers = ig.followers + fb.followers;
  const avgRate = ((ig.engagementRate + fb.engagementRate) / 2);
  const anyMock = ig.mock || fb.mock;

  return (
    <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onJumpInstagram}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", font: "600 13.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}
        >
          <Icon name="instagram" size={15} />
          IG {ig.handle ? `@${ig.handle}` : ""} {fmtK(ig.followers)}
        </button>
        <span style={{ color: "var(--w-fg-alternative)" }}>·</span>
        <button
          type="button"
          onClick={onJumpFacebook}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", font: "600 13.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}
        >
          <Icon name="facebook" size={15} />
          FB {fb.name ?? ""} {fmtK(fb.followers)}
        </button>
        <span style={{ font: "500 13px/1.3 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
          — 합계 {fmtK(totalFollowers)} 팔로워
          <span
            title="IG와 FB 팔로워는 같은 사람일 수 있어 단순 합산은 중복될 수 있어요"
            style={{ marginLeft: 4, display: "inline-flex", alignItems: "center", color: "var(--w-fg-alternative)", cursor: "help" }}
          >
            <Icon name="info" size={12} />
          </span>
          {" · 평균 반응률 "}{avgRate.toFixed(1)}%
        </span>
      </div>

      {anyMock && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "var(--w-accent-violet-soft)", color: "var(--w-accent-violet)", font: "600 11.5px/1 var(--w-font-sans)" }}>
          mock 포함
        </span>
      )}
    </div>
  );
}
