import { describe, expect, it } from "vitest";
import { mapAudienceError } from "./errors";

describe("mapAudienceError", () => {
  it("#2654 계열(CA ToS 미수락) → 한국어 안내 + Ads Manager 딥링크", () => {
    const result = mapAudienceError({ code: 2654 }, "act_123456789");
    expect(result.message).toBe("광고 계정에서 맞춤 타겟 약관 수락이 필요해요");
    expect(result.tosAcceptUrl).toBe(
      "https://business.facebook.com/ads/manage/customaudiences/tos/?act=123456789",
    );
  });

  it("act_ 접두 없는 accountId 도 그대로 딥링크에 반영한다", () => {
    const result = mapAudienceError({ code: 2654 }, "123456789");
    expect(result.tosAcceptUrl).toBe(
      "https://business.facebook.com/ads/manage/customaudiences/tos/?act=123456789",
    );
  });

  it("Meta 가 준 user message 가 있으면 그대로 사용한다", () => {
    const result = mapAudienceError({ code: 100, userMessage: "필드 값이 올바르지 않아요." }, "act_1");
    expect(result.message).toBe("필드 값이 올바르지 않아요.");
    expect(result.tosAcceptUrl).toBeUndefined();
  });

  it("알려진 코드도 user message 도 없으면 제네릭 폴백", () => {
    const result = mapAudienceError({ code: 999 }, "act_1");
    expect(result.message).toBe("맞춤 타겟을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
  });
});
