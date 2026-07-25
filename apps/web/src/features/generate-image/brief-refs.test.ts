import { describe, it, expect } from "vitest";
import type { ReferenceMaterial } from "@shared/lib/referenceMaterials";
import { splitDataUrl, computeBriefTargets, buildBriefRefs } from "./brief-refs";

const mat = (over: Partial<ReferenceMaterial>): ReferenceMaterial =>
  ({ id: "m", name: "자료", type: "image", storageUrl: "data:image/png;base64,AAA", createdAt: "", ...over }) as ReferenceMaterial;

describe("splitDataUrl", () => {
  it("정상 data URL → mime + base64 분리", () => {
    expect(splitDataUrl("data:image/png;base64,AAAB")).toEqual({ mimeType: "image/png", dataBase64: "AAAB" });
  });
  it("형식 안 맞으면 null", () => {
    expect(splitDataUrl("https://x/y.png")).toBeNull();
    expect(splitDataUrl("")).toBeNull();
  });
});

describe("computeBriefTargets", () => {
  it("null → 전부 대상", () => {
    expect(computeBriefTargets(null)).toEqual([0, 1, 2]);
  });
  it("일부 채워짐 → 빈 슬롯만", () => {
    expect(computeBriefTargets(["x", "", "z"])).toEqual([1]);
  });
  it("전부 채워짐 → 빈 배열", () => {
    expect(computeBriefTargets(["a", "b", "c"])).toEqual([]);
  });
});

describe("buildBriefRefs", () => {
  it("연출컷 + 로고 → sceneRefs(로고가 뒤에 합류)", () => {
    const { sceneRefs } = buildBriefRefs({
      scenes: ["data:image/png;base64,SCENE"],
      logo: "data:image/png;base64,LOGO",
      materials: [],
    });
    expect(sceneRefs).toEqual([
      { mimeType: "image/png", dataBase64: "SCENE" },
      { mimeType: "image/png", dataBase64: "LOGO" },
    ]);
  });

  it("image·pdf 자료는 ref 로, txt 자료는 본문으로 분기", () => {
    const { sceneRefs, txtText } = buildBriefRefs({
      scenes: [],
      logo: null,
      materials: [
        mat({ id: "i", type: "image", storageUrl: "data:image/jpeg;base64,IMG" }),
        mat({ id: "p", type: "pdf", storageUrl: "data:application/pdf;base64,PDF" }),
        mat({ id: "t", type: "txt", name: "브리프", storageUrl: "data:text/plain;base64,aGVsbG8=" }), // "hello"
      ],
    });
    expect(sceneRefs).toEqual([
      { mimeType: "image/jpeg", dataBase64: "IMG" },
      { mimeType: "application/pdf", dataBase64: "PDF" },
    ]);
    expect(txtText).toBe("[참고 자료: 브리프]\nhello");
  });

  it("base64 가 아닌 잘못된 ref 는 걸러짐", () => {
    const { sceneRefs } = buildBriefRefs({
      scenes: ["not-a-data-url", "data:image/png;base64,OK"],
      logo: null,
      materials: [],
    });
    expect(sceneRefs).toEqual([{ mimeType: "image/png", dataBase64: "OK" }]);
  });

  it("txt 자료 없음 → 빈 문자열", () => {
    const { txtText } = buildBriefRefs({ scenes: [], logo: null, materials: [] });
    expect(txtText).toBe("");
  });
});
