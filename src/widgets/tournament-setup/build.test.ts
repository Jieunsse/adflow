import { describe, it, expect } from "vitest";
import type { TourVariant } from "@entities/ab-test/tournament/engine";
import {
  STARTING_CTR,
  buildTournamentRequest,
  buildDemoSetup,
  buildChallengerVariant,
  pickFromPool,
  challengerReady,
  canStart,
  type SetupFormState,
} from "./build";

const CHAMP: TourVariant = { headline: "기존 헤드라인", primaryText: "기존 카피", imageUrl: "champ.jpg" };

const baseForm: SetupFormState = {
  championMode: "ai",
  selected: null,
  champVariant: null,
  productId: "",
  productName: "  수분 크림  ",
  description: "  비건 보습  ",
  tone: "warm",
  objective: "traffic",
  totalBudget: 600000,
  dailyBudget: 30000,
  chAxis: "headline",
  challenger: { headline: "", primary: "", image: "" },
  landingUrl: "  https://x.com  ",
  ctaType: "LEARN_MORE",
  country: "KR",
  ageMin: 18,
  ageMax: 65,
};

const existingForm: SetupFormState = {
  ...baseForm,
  championMode: "existing",
  selected: { ctr: 4.2, name: "여름 세일 광고" },
  champVariant: CHAMP,
  productId: "prod-1",
  challenger: { headline: "새 헤드라인", primary: "", image: "" },
};

describe("buildTournamentRequest", () => {
  it("ai 모드 → startingCtr 기준선·championSource ai·startingChampion 미설정", () => {
    const r = buildTournamentRequest(baseForm, "");
    expect(r.startingCtr).toBe(STARTING_CTR);
    expect(r.championSource).toBe("ai");
    expect(r.startingChampion).toBeUndefined();
    expect(r.championSourceName).toBeUndefined();
  });

  it("existing 모드 → 광고 실제 CTR·startingChampion·sourceName 실림", () => {
    const r = buildTournamentRequest(existingForm, "bp-9");
    expect(r.startingCtr).toBe(4.2);
    expect(r.championSource).toBe("existing");
    expect(r.startingChampion).toEqual(CHAMP);
    expect(r.championSourceName).toBe("여름 세일 광고");
  });

  it("brandProfileId 빈값 → 'default' 폴백·productId 빈값 → 'manual'", () => {
    const r = buildTournamentRequest(baseForm, "");
    expect(r.brandProfileId).toBe("default");
    expect(r.productId).toBe("manual");
  });

  it("문자열 필드 trim — productName·description·linkUrl", () => {
    const r = buildTournamentRequest(baseForm, "bp");
    expect(r.productName).toBe("수분 크림");
    expect(r.brandDescription).toBe("비건 보습");
    expect(r.linkUrl).toBe("https://x.com");
  });

  it("게재 봉투 패스스루 — countries·cta·연령·goalId=objective", () => {
    const r = buildTournamentRequest(existingForm, "bp");
    expect(r.countries).toEqual(["KR"]);
    expect(r.ctaType).toBe("LEARN_MORE");
    expect(r.ageMin).toBe(18);
    expect(r.ageMax).toBe(65);
    expect(r.goalId).toBe("traffic");
    expect(r.mode).toBe("auto");
  });
});

describe("buildDemoSetup", () => {
  it("brandProfile/product 는 browse 고정·delivery 봉투 없음", () => {
    const s = buildDemoSetup(existingForm);
    expect(s.brandProfileId).toBe("browse");
    expect(s.productId).toBe("browse");
    expect("linkUrl" in s).toBe(false);
  });

  it("existing → startingCtr·champion 시드 동일 규칙", () => {
    const s = buildDemoSetup(existingForm);
    expect(s.startingCtr).toBe(4.2);
    expect(s.startingChampion).toEqual(CHAMP);
  });
});

describe("buildChallengerVariant — 3축 통일", () => {
  it("headline 축 → headline 만 교체(trim), 나머지 챔피언 유지", () => {
    const v = buildChallengerVariant("headline", CHAMP, { headline: "  새 H  ", primary: "X", image: "Y" });
    expect(v).toEqual({ headline: "새 H", primaryText: "기존 카피", imageUrl: "champ.jpg" });
  });

  it("primary_text 축 → primaryText 만 교체(trim)", () => {
    const v = buildChallengerVariant("primary_text", CHAMP, { headline: "X", primary: "  새 카피 ", image: "Y" });
    expect(v).toEqual({ headline: "기존 헤드라인", primaryText: "새 카피", imageUrl: "champ.jpg" });
  });

  it("image 축 → imageUrl 만 교체(trim 안 함)", () => {
    const v = buildChallengerVariant("image", CHAMP, { headline: "X", primary: "Y", image: "new.jpg" });
    expect(v).toEqual({ headline: "기존 헤드라인", primaryText: "기존 카피", imageUrl: "new.jpg" });
  });
});

describe("pickFromPool", () => {
  const pool = ["A", "B", "C", "D"];
  it("slight → 챔피언과 다른 첫 후보", () => {
    expect(pickFromPool(pool, "A", "slight")).toBe("B");
  });
  it("bold → 가장 먼 끝 후보", () => {
    expect(pickFromPool(pool, "A", "bold")).toBe("D");
  });
  it("moderate → 중간 후보", () => {
    expect(pickFromPool(pool, "A", "moderate")).toBe("C"); // filtered=[B,C,D], idx=1
  });
  it("후보가 챔피언뿐 → pool[0] 폴백", () => {
    expect(pickFromPool(["A"], "A", "slight")).toBe("A");
  });
});

describe("canStart 게이트", () => {
  it("real 모드 → 랜딩 URL 비면 차단", () => {
    expect(canStart({ ...existingForm, landingUrl: "   " }, true)).toBe(false);
    expect(canStart(existingForm, true)).toBe(true);
  });
  it("demo 모드 → 랜딩 URL 불필요", () => {
    expect(canStart({ ...existingForm, landingUrl: "" }, false)).toBe(true);
  });
  it("예산 0 → 차단", () => {
    expect(canStart({ ...existingForm, dailyBudget: 0 }, false)).toBe(false);
    expect(canStart({ ...existingForm, totalBudget: 0 }, false)).toBe(false);
  });
  it("challengerReady — image 축은 image 입력 필요", () => {
    expect(challengerReady("image", { headline: "", primary: "", image: "" })).toBe(false);
    expect(challengerReady("image", { headline: "", primary: "", image: "x.jpg" })).toBe(true);
  });
});
