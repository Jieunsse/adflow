import { describe, expect, it } from "vitest";
import {
  diffSnapshots,
  snapshotMap,
  type AdEffectiveStatus,
  type AdSnapshot,
} from "./ad-status-diff";

function ad(
  adId: string,
  status: AdEffectiveStatus,
  overrides: Partial<AdSnapshot> = {},
): AdSnapshot {
  return {
    adId,
    campaignId: overrides.campaignId ?? `camp-${adId}`,
    name: overrides.name ?? `광고 ${adId}`,
    status,
    issueReason: overrides.issueReason ?? null,
  };
}

describe("diffSnapshots — emit 매트릭스", () => {
  it("PENDING_REVIEW → ACTIVE = 승인 알림", () => {
    const prev = snapshotMap([ad("1", "PENDING_REVIEW")]);
    const next = [ad("1", "ACTIVE")];
    const out = diffSnapshots(prev, next);
    expect(out).toHaveLength(1);
    expect(out[0].transition).toBe("PENDING_REVIEW->ACTIVE");
    expect(out[0].message).toContain("승인됐어요");
  });

  it("PENDING_REVIEW → DISAPPROVED = 거부 + 사유 truncate", () => {
    const longReason = "이미지에 부적절한 텍스트가 포함되어 있습니다. ".repeat(10);
    const prev = snapshotMap([ad("1", "PENDING_REVIEW")]);
    const next = [ad("1", "DISAPPROVED", { issueReason: longReason })];
    const out = diffSnapshots(prev, next);
    expect(out).toHaveLength(1);
    expect(out[0].message).toContain("거부됐어요");
    expect(out[0].message.length).toBeLessThan(150);
  });

  it("PENDING_REVIEW → WITH_ISSUES = 이슈 발견 알림", () => {
    const prev = snapshotMap([ad("1", "PENDING_REVIEW")]);
    const next = [ad("1", "WITH_ISSUES")];
    expect(diffSnapshots(prev, next)[0].transition).toBe("PENDING_REVIEW->WITH_ISSUES");
  });

  it("ACTIVE → DISAPPROVED = 거부 알림", () => {
    const prev = snapshotMap([ad("1", "ACTIVE")]);
    const next = [ad("1", "DISAPPROVED", { issueReason: "정책 위반" })];
    const out = diffSnapshots(prev, next);
    expect(out[0].message).toContain("거부됐어요");
    expect(out[0].message).toContain("정책 위반");
  });

  it("ACTIVE → WITH_ISSUES = 이슈 알림", () => {
    const prev = snapshotMap([ad("1", "ACTIVE")]);
    const next = [ad("1", "WITH_ISSUES", { issueReason: "타겟 협소" })];
    expect(diffSnapshots(prev, next)[0].transition).toBe("ACTIVE->WITH_ISSUES");
  });

  it("WITH_ISSUES → ACTIVE = 이슈 해결 알림", () => {
    const prev = snapshotMap([ad("1", "WITH_ISSUES")]);
    const next = [ad("1", "ACTIVE")];
    expect(diffSnapshots(prev, next)[0].message).toContain("해결됐어요");
  });

  it("DISAPPROVED → ACTIVE = 어필 통과 알림", () => {
    const prev = snapshotMap([ad("1", "DISAPPROVED")]);
    const next = [ad("1", "ACTIVE")];
    expect(diffSnapshots(prev, next)[0].message).toContain("어필이 통과");
  });

  it("ACTIVE → PAUSED = emit 안 함 (모호)", () => {
    const prev = snapshotMap([ad("1", "ACTIVE")]);
    const next = [ad("1", "PAUSED")];
    expect(diffSnapshots(prev, next)).toHaveLength(0);
  });

  it("PAUSED → ACTIVE = emit 안 함 (모호)", () => {
    const prev = snapshotMap([ad("1", "PAUSED")]);
    const next = [ad("1", "ACTIVE")];
    expect(diffSnapshots(prev, next)).toHaveLength(0);
  });

  it("신규 등장 = emit 안 함 (baseline)", () => {
    const prev = snapshotMap([]);
    const next = [ad("1", "PENDING_REVIEW")];
    expect(diffSnapshots(prev, next)).toHaveLength(0);
  });

  it("동일 상태 유지 = emit 안 함", () => {
    const prev = snapshotMap([ad("1", "ACTIVE")]);
    const next = [ad("1", "ACTIVE")];
    expect(diffSnapshots(prev, next)).toHaveLength(0);
  });

  it("issueReason 비어있으면 fallback 메시지", () => {
    const prev = snapshotMap([ad("1", "PENDING_REVIEW")]);
    const next = [ad("1", "DISAPPROVED", { issueReason: null })];
    expect(diffSnapshots(prev, next)[0].message).toContain("Ads Manager");
  });
});
