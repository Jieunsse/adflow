import { describe, expect, it } from "vitest";
import { browseCreative, browseRefinedBody, browseVariants } from "./seed";
import { recommendedHooks } from "../options";
import type { GenerateCreativeParams } from "@/lib/gemini-creative";

const PROOFS = ["재구매율 38%", "비건 인증(한국비건인증원)", "EWG 그린 등급 전성분"];

const base: GenerateCreativeParams = {
  brand: "그린루틴",
  tone: "warm",
  outcome: "engagement_page_likes",
};

describe("browseVariants", () => {
  it("광고 목표가 바뀌면 3안도 바뀐다", () => {
    const engage = browseVariants("engagement_page_likes");
    const traffic = browseVariants("traffic");
    expect(engage[0].headline).not.toBe(traffic[0].headline);
  });

  it("같은 metaObjective 끼리는 같은 문구를 쓴다", () => {
    expect(browseVariants("traffic")).toEqual(browseVariants("traffic_page_visit"));
  });

  it("문구가 안 준비된 목표는 폴백으로 3안을 채운다", () => {
    const v = browseVariants("sales");
    expect(v).toHaveLength(3);
    expect(v[0].headline.length).toBeGreaterThan(0);
  });
});

describe("browseCreative", () => {
  it("실제 API 와 같은 모양으로 3안을 돌려준다", () => {
    const r = browseCreative(base);
    expect(r.headlines).toHaveLength(3);
    expect(r.subtitles).toHaveLength(3);
    expect(r.primaryTexts).toHaveLength(3);
    expect(r.targeting.ageMin).toBeLessThan(r.targeting.ageMax);
  });

  it("배지에 쓰이는 훅은 그 목표의 추천 훅과 같다", () => {
    expect(browseCreative(base).hooks).toEqual(recommendedHooks("engagement_page_likes"));
  });

  it("호출부가 훅을 지정하면 그대로 따른다", () => {
    const r = browseCreative({ ...base, hooks: ["rush", "rush", "rush"] });
    expect(r.hooks).toEqual(["rush", "rush", "rush"]);
  });

  it("근거 인용은 본문에 그 문구가 실제로 있을 때만 true", () => {
    const r = browseCreative({ ...base, brandProfile: { proofPoints: PROOFS } });
    r.proofPointsCited?.forEach((cited, i) => {
      expect(cited).toBe(PROOFS.some((t) => r.primaryTexts[i].includes(t)));
    });
  });

  it("근거 자료가 없으면 반영됐다고 말하지 않는다", () => {
    const r = browseCreative(base);
    expect(r.proofPointsCited).toEqual([false, false, false]);
    expect(r.attribution?.reflected).toEqual([]);
  });

  it("전달한 재료만 귀인에 올린다", () => {
    const r = browseCreative({
      ...base,
      brandProfile: { brandVoice: "친근하게" },
      persona: { name: "20대 여성 대학생" },
    });
    expect(r.attribution?.injected).toEqual(["tone", "brandVoice", "persona"]);
  });
});

describe("browseRefinedBody", () => {
  const body = "첫 줄이에요!\n둘째 줄이에요.\n셋째 줄이에요.\n지금 확인해보세요.";

  it("더 짧게 — 앞 두 줄만 남긴다", () => {
    expect(browseRefinedBody(body, "shorter", {})).toBe("첫 줄이에요!\n둘째 줄이에요.");
  });

  it("더 짧게 — 한 줄짜리는 앞 두 문장만 남긴다", () => {
    expect(browseRefinedBody("하나. 둘. 셋. 넷.", "shorter", {})).toBe("하나. 둘.");
  });

  it("더 부드럽게 — 느낌표를 빼고 마지막 명령형을 눅인다", () => {
    expect(browseRefinedBody(body, "softer", {})).toBe(
      "첫 줄이에요.\n둘째 줄이에요.\n셋째 줄이에요.\n지금 확인해보셔도 좋아요.",
    );
  });

  it("더 부드럽게 — 눅일 게 없으면 여지를 주는 한 줄을 더한다", () => {
    const flat = "그린루틴이에요 🌿\n식물 유래 성분만 담았어요.";
    const out = browseRefinedBody(flat, "softer", {});
    expect(out).toBe(`${flat}\n부담 없이 천천히 살펴보셔도 괜찮아요.`);
    // 두 번 눌러도 한 줄만
    expect(browseRefinedBody(out, "softer", {})).toBe(out);
  });

  it("숫자 강조 — 숫자가 든 근거를 맨 앞에 올린다", () => {
    expect(browseRefinedBody(body, "numbers", { proofPoints: PROOFS })).toMatch(/^재구매율 38%\./);
  });

  it("숫자 강조 — 이미 들어 있으면 또 붙이지 않는다", () => {
    const withProof = `재구매율 38%.\n${body}`;
    expect(browseRefinedBody(withProof, "numbers", { proofPoints: PROOFS })).toBe(withProof);
  });

  it("숫자 강조 — 숫자 근거가 없으면 본문을 그대로 둔다", () => {
    expect(browseRefinedBody(body, "numbers", { proofPoints: ["비건 인증"] })).toBe(body);
  });

  it("행동 유도 추가 — CTA 문장을 한 줄 더한다", () => {
    const out = browseRefinedBody(body, "cta", { ctaLabel: "페이지 좋아요" });
    expect(out.endsWith("페이지 좋아요, 지금 확인해보세요.")).toBe(true);
  });

  it("행동 유도 추가 — 두 번 눌러도 한 줄만 붙는다", () => {
    const once = browseRefinedBody(body, "cta", { ctaLabel: "페이지 좋아요" });
    expect(browseRefinedBody(once, "cta", { ctaLabel: "페이지 좋아요" })).toBe(once);
  });

  it("빈 본문은 건드리지 않는다", () => {
    expect(browseRefinedBody("", "shorter", {})).toBe("");
  });
});
