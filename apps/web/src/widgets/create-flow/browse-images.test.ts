import { describe, expect, it } from "vitest";
import { pickBrowseShots } from "./browse-images";

const urls = (rotate = 0, product: string | null = null) =>
  pickBrowseShots(product, rotate).map((s) => s.url);

describe("pickBrowseShots", () => {
  it("고른 제품 사진이 첫 컷으로 온다", () => {
    expect(urls(0, "/demo/library/toner.jpg")[0]).toBe("/demo/library/toner.jpg");
  });

  it("데모 사진이 아닌 주소는 무시한다", () => {
    expect(urls(0, "https://cdn.example.com/mine.jpg")).toEqual(urls(0));
  });

  it("3컷이 서로 겹치지 않는다", () => {
    for (const product of [null, "/demo/library/cream.jpg", "/demo/library/lipbalm.webp"]) {
      for (let rotate = 0; rotate < 8; rotate++) {
        expect(new Set(urls(rotate, product)).size).toBe(3);
      }
    }
  });

  it("분위기를 바꾸면(rotate) 다른 컷이 나온다", () => {
    expect(urls(0)).not.toEqual(urls(1));
  });

  it("제품을 골랐어도 첫 컷은 고정, 뒤 두 장만 바뀐다", () => {
    const a = urls(0, "/demo/library/cream.jpg");
    const b = urls(1, "/demo/library/cream.jpg");
    expect(a[0]).toBe(b[0]);
    expect(a.slice(1)).not.toEqual(b.slice(1));
  });

  it("같은 입력이면 늘 같은 결과 — 시연이 재현된다", () => {
    expect(urls(2, "/demo/library/pad.jpg")).toEqual(urls(2, "/demo/library/pad.jpg"));
  });

  it("모든 컷이 라벨과 설명을 갖는다", () => {
    for (const shot of pickBrowseShots(null)) {
      expect(shot.label.length).toBeGreaterThan(0);
      expect(shot.note.length).toBeGreaterThan(0);
    }
  });
});
