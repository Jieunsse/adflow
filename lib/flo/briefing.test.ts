import { describe, expect, it } from "vitest";
import { buildPrompt, parseBriefing } from "./briefing";
import type { FloContext } from "./types";

const baseCtx: FloContext = {
  adAccountId: "act_1",
  campaigns: [
    {
      headline: "여름 원피스",
      objective: "OUTCOME_TRAFFIC",
      status: "live",
      impressions: 80_000,
      clicks: 2_000,
      ctr: 2.5,
      spend: 300_000,
      dailyBudget: 30_000,
      fakePerformance: "가짜 성과 의심 — CTR 2.5% 대비 도착률 38% (클릭 후 이탈 62%)",
    },
  ],
  instagram: {
    channel: "instagram",
    followers: 8_000,
    engagementRate: 0.7,
    suggestions: ["인게이지먼트율이 낮아요"],
  },
  facebook: undefined,
  tournaments: [
    { productName: "원피스", objective: "OUTCOME_TRAFFIC", round: 2, latestVerdict: "challenger_win" },
  ],
};

describe("buildPrompt — 룰 판정 동반 주입(근거 고정)", () => {
  it("가짜 성과 의심 판정이 프롬프트에 들어간다", () => {
    const p = buildPrompt(baseCtx);
    expect(p).toContain("가짜 성과 의심");
    expect(p).toContain("도착률 38%");
  });

  it("채널 룰 제안이 프롬프트에 들어간다", () => {
    expect(buildPrompt(baseCtx)).toContain("인게이지먼트율이 낮아요");
  });

  it("진행 중 토너먼트와 최근 판정이 들어간다", () => {
    const p = buildPrompt(baseCtx);
    expect(p).toContain("원피스");
    expect(p).toContain("challenger_win");
  });

  it("브랜드 proofPoints 가 있으면 주입된다", () => {
    const p = buildPrompt({ ...baseCtx, brand: { name: "브랜드", proofPoints: ["누적 10만 판매"] } });
    expect(p).toContain("누적 10만 판매");
  });

  it("소스가 비어도 깨지지 않고 안내 문구를 낸다", () => {
    const p = buildPrompt({ adAccountId: "x", campaigns: [], tournaments: [] });
    expect(p).toContain("광고 성과가 없어요");
    expect(p).toContain("진행 중인 토너먼트가 없어요");
  });
});

describe("parseBriefing — structured output 방어", () => {
  const valid = JSON.stringify({
    headline: "계정은 전반적으로 양호해요",
    findings: [
      {
        severity: "warn",
        title: "클릭 후 이탈이 높아요",
        diagnosis: "도착률이 낮아요",
        suggestion: "랜딩 페이지를 점검하세요",
        alternative: "타겟을 좁혀보세요",
        action: { label: "캠페인 보기", href: "/campaigns" },
      },
    ],
  });

  it("정상 JSON 을 파싱한다", () => {
    const b = parseBriefing(valid);
    expect(b.headline).toContain("양호");
    expect(b.findings).toHaveLength(1);
    expect(b.findings[0].action?.href).toBe("/campaigns");
  });

  it("깨진 JSON 은 사용자향 에러로 throw", () => {
    expect(() => parseBriefing("{ not json")).toThrow();
  });

  it("headline 이 없으면 throw", () => {
    expect(() => parseBriefing(JSON.stringify({ findings: [] }))).toThrow();
  });

  it("필수 필드 빠진 finding 은 걸러지고, 전부 무효면 throw", () => {
    const bad = JSON.stringify({ headline: "h", findings: [{ title: "제목만" }] });
    expect(() => parseBriefing(bad)).toThrow();
  });

  it("잘못된 severity 는 info 로, 외부 href 는 버린다", () => {
    const mixed = JSON.stringify({
      headline: "h",
      findings: [
        {
          severity: "danger",
          title: "t",
          diagnosis: "d",
          suggestion: "s",
          action: { label: "x", href: "https://evil.com" },
        },
      ],
    });
    const b = parseBriefing(mixed);
    expect(b.findings[0].severity).toBe("info");
    expect(b.findings[0].action).toBeUndefined();
  });
});
