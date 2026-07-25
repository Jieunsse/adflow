import { describe, expect, it } from "vitest";
import { selectProfileNudge, type ProfileNudgeTarget } from "./profile-nudge";

const NONE: Record<ProfileNudgeTarget, boolean> = {
  persona: false, product: false, proofPoints: false,
  imageGuide: false, tone: false, brandVoice: false,
};
const ALL: Record<ProfileNudgeTarget, boolean> = {
  persona: true, product: true, proofPoints: true,
  imageGuide: true, tone: true, brandVoice: true,
};

describe("selectProfileNudge — outcome 조건부 결정적 단일 넛지 (ADR-052)", () => {
  it("전환형(traffic) 전부 비면 근거 자료를 1순위로 권한다", () => {
    expect(selectProfileNudge("traffic", NONE)?.target).toBe("proofPoints");
  });

  it("노출형(awareness) 전부 비면 페르소나를 1순위로 권한다", () => {
    expect(selectProfileNudge("awareness", NONE)?.target).toBe("persona");
  });

  it("참여형(engagement) 전부 비면 페르소나를 1순위로 권한다", () => {
    expect(selectProfileNudge("engagement", NONE)?.target).toBe("persona");
  });

  it("1순위가 채워지면 다음 우선순위로 넘어간다 (traffic: proofPoints→persona)", () => {
    expect(selectProfileNudge("traffic", { ...NONE, proofPoints: true })?.target).toBe("persona");
  });

  it("빈 필드가 없으면 null (잔소리 없음)", () => {
    expect(selectProfileNudge("traffic", ALL)).toBeNull();
  });

  it("넛지에는 빈 필드에 대한 사실 진술 reason 이 붙는다", () => {
    const nudge = selectProfileNudge("traffic", NONE);
    expect(nudge?.reason).toBeTruthy();
  });
});
