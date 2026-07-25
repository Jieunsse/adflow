import { describe, expect, it } from "vitest";
import { normalizeVariants, buildVariantContents, type ReferenceImage } from "./gemini-image";

const REF: ReferenceImage = { mimeType: "image/png", dataBase64: "AAAA" };

describe("normalizeVariants — variants[] 통일 계약", () => {
  it("레거시 {prompt, count} 페이로드는 더는 받아들여지지 않는다 (variants 없음 → throw)", () => {
    expect(() => normalizeVariants({ prompt: "x", count: 3 } as never)).toThrow();
  });

  it("variants 빈 배열이면 throw", () => {
    expect(() => normalizeVariants({ variants: [] })).toThrow();
  });

  it("모든 variant 가 prompt·ref 둘 다 없고 공통 ref 도 없으면 throw", () => {
    expect(() => normalizeVariants({ variants: [{ prompt: "" }, { prompt: "  " }] })).toThrow();
  });

  it("prompt 있는 variant 들은 trim 되어 순서대로 보존된다", () => {
    const { variants, common } = normalizeVariants({ variants: [{ prompt: " a " }, { prompt: "b" }] });
    expect(variants.map((v) => v.prompt)).toEqual(["a", "b"]);
    expect(common).toEqual([]);
  });

  it("공통 referenceImages 가 있으면 prompt 빈 variant 도 렌더 가능", () => {
    const { variants, common } = normalizeVariants({ variants: [{ prompt: "" }], referenceImages: [REF] });
    expect(variants).toHaveLength(1);
    expect(common).toEqual([REF]);
  });

  it("variant 수는 MAX_COUNT(4) 로 cap", () => {
    const { variants } = normalizeVariants({
      variants: [{ prompt: "1" }, { prompt: "2" }, { prompt: "3" }, { prompt: "4" }, { prompt: "5" }],
    });
    expect(variants).toHaveLength(4);
  });
});

describe("buildVariantContents — 공통+전용 ref 병합", () => {
  it("ref 들이 inlineData 로 먼저, 지시 텍스트가 뒤에 온다", () => {
    const parts = buildVariantContents("studio shot", [REF, REF]);
    const inlineCount = parts.filter((p) => "inlineData" in p).length;
    const textParts = parts.filter((p): p is { text: string } => "text" in p);
    expect(inlineCount).toBe(2);
    expect(textParts).toHaveLength(1);
    expect(textParts[0].text).toContain("studio shot");
  });

  it("ref 없으면 inlineData 없이 prompt 텍스트만", () => {
    const parts = buildVariantContents("clean product", []);
    expect(parts.filter((p) => "inlineData" in p)).toHaveLength(0);
    expect(parts.filter((p) => "text" in p)).toHaveLength(1);
  });

  it("preserve + ref: 원본 보존 프롬프트 (style guide 아님) — ADR-041", () => {
    const text = (buildVariantContents("on a beach blanket", [REF], true).find(
      (p): p is { text: string } => "text" in p,
    ))!.text;
    expect(text).toContain("Preserve the product exactly");
    expect(text).toContain("on a beach blanket");
    expect(text).not.toContain("style guide");
  });

  it("preserve 인데 ref 없으면 보존 프롬프트로 안 빠진다 (기본 동작)", () => {
    const text = (buildVariantContents("clean product", [], true).find(
      (p): p is { text: string } => "text" in p,
    ))!.text;
    expect(text).not.toContain("Preserve the product exactly");
  });

  it("preserve=false + ref: 기존 style guide 유지 (brief 연출컷 회귀 가드)", () => {
    const text = (buildVariantContents("studio", [REF], false).find(
      (p): p is { text: string } => "text" in p,
    ))!.text;
    expect(text).toContain("style guide");
    expect(text).not.toContain("Preserve the product exactly");
  });
});
