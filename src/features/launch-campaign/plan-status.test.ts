import { describe, expect, it } from "vitest";
import { launchBlockReason, firstInvalidCard, type LaunchGateInput } from "./plan-status";

const base: LaunchGateInput = {
  hasCreative: true,
  accountConnected: true,
  browseMode: false,
  countriesCount: 1,
  urlRequired: true,
  httpsOk: true,
  isPending: false,
  alreadyLaunched: false,
};

describe("launchBlockReason", () => {
  it("모든 조건 충족 → null (게재 가능)", () => {
    expect(launchBlockReason(base)).toBeNull();
  });

  it("이미 게재됨 → null (재게재 버튼 자체가 안 뜨므로 사유 불필요)", () => {
    expect(launchBlockReason({ ...base, alreadyLaunched: true, accountConnected: false })).toBeNull();
  });

  it("전송 중 → 전송 중 메시지 우선", () => {
    expect(launchBlockReason({ ...base, isPending: true, accountConnected: false })).toContain("전송하는 중");
  });

  it("계정 미연결 (non-browse) → 계정 사유", () => {
    expect(launchBlockReason({ ...base, accountConnected: false })).toContain("계정");
  });

  it("browseMode 이면 계정 미연결이어도 통과", () => {
    expect(launchBlockReason({ ...base, accountConnected: false, browseMode: true })).toBeNull();
  });

  it("소재 없음 → 소재 사유", () => {
    expect(launchBlockReason({ ...base, hasCreative: false })).toContain("소재");
  });

  it("URL 필요한데 https 아님 → URL 사유", () => {
    expect(launchBlockReason({ ...base, httpsOk: false })).toContain("URL");
  });

  it("URL 불필요(hidden) → https 상관없이 통과", () => {
    expect(launchBlockReason({ ...base, urlRequired: false, httpsOk: false })).toBeNull();
  });

  it("국가 0개 → 국가 사유", () => {
    expect(launchBlockReason({ ...base, countriesCount: 0 })).toContain("국가");
  });

  it("우선순위 — 계정 미연결이 소재 없음보다 먼저 보고됨", () => {
    const reason = launchBlockReason({ ...base, accountConnected: false, hasCreative: false });
    expect(reason).toContain("계정");
  });
});

describe("firstInvalidCard", () => {
  it("둘 다 유효 → null", () => {
    expect(firstInvalidCard({ urlRequired: true, httpsOk: true, countriesCount: 1 })).toBeNull();
  });

  it("URL 문제 → destination 우선", () => {
    expect(firstInvalidCard({ urlRequired: true, httpsOk: false, countriesCount: 0 })).toBe("destination");
  });

  it("URL 은 정상, 국가만 문제 → target", () => {
    expect(firstInvalidCard({ urlRequired: true, httpsOk: true, countriesCount: 0 })).toBe("target");
  });

  it("URL 불필요 + 국가 문제 → target", () => {
    expect(firstInvalidCard({ urlRequired: false, httpsOk: false, countriesCount: 0 })).toBe("target");
  });
});
