import { describe, expect, it } from "vitest";
import { toPublicUrl, toStoragePath } from "./files";

describe("toPublicUrl", () => {
  it("버킷 상대 경로를 /api/files 로 조립해요", () => {
    expect(toPublicUrl("product-images/bp_1/p.png")).toBe("/api/files/product-images/bp_1/p.png");
  });

  it("data: URL 은 그대로 둬요", () => {
    // 게스트·오프라인 폴백은 base64 를 그대로 들고 있다. 접두사를 붙이면 이미지가 깨진다.
    expect(toPublicUrl("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
  });

  it("절대 URL 과 절대 경로는 그대로 둬요", () => {
    // 데모 시드(/demo/…)와 이관 전 Supabase public URL 이 둘 다 여기로 온다.
    expect(toPublicUrl("https://x.supabase.co/a.png")).toBe("https://x.supabase.co/a.png");
    expect(toPublicUrl("/demo/library/serum.jpg")).toBe("/demo/library/serum.jpg");
  });

  it("빈 값은 undefined 예요", () => {
    expect(toPublicUrl(undefined)).toBeUndefined();
    expect(toPublicUrl(null)).toBeUndefined();
    expect(toPublicUrl("")).toBeUndefined();
  });
});

describe("toStoragePath", () => {
  it("조립된 URL 을 저장 경로로 되돌려요", () => {
    // 클라가 돌려보낸 imageUrl 을 다시 DB 에 넣을 때 접두사가 겹치면 안 된다.
    expect(toStoragePath("/api/files/product-images/bp_1/p.png")).toBe(
      "product-images/bp_1/p.png",
    );
  });

  it("접두사가 없으면 그대로 둬요", () => {
    expect(toStoragePath("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
    expect(toStoragePath("product-images/bp_1/p.png")).toBe("product-images/bp_1/p.png");
  });

  it("빈 값은 undefined 예요", () => {
    expect(toStoragePath(undefined)).toBeUndefined();
    expect(toStoragePath("")).toBeUndefined();
  });

  it("조립과 되돌리기가 왕복해요", () => {
    const path = "reference-materials/bp_9/ref_9.pdf";
    expect(toStoragePath(toPublicUrl(path))).toBe(path);
  });
});
