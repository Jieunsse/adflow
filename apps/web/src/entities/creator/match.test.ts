import { describe, it, expect } from "vitest";
import { findCreatorByHandle } from "./match";
import type { Creator } from "./model";

function creator(overrides: Partial<Creator>): Creator {
  return {
    id: "c-1",
    handle: "@handle",
    platform: "instagram",
    category: [],
    performanceHistory: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("findCreatorByHandle", () => {
  it("@ 유무·대소문자 무시하고 매칭", () => {
    const creators = [creator({ id: "c-1", handle: "@FoodieKim" })];

    expect(findCreatorByHandle(creators, "foodiekim")?.id).toBe("c-1");
    expect(findCreatorByHandle(creators, "@foodiekim")?.id).toBe("c-1");
  });

  it("일치하는 크리에이터 없으면 undefined", () => {
    const creators = [creator({ id: "c-1", handle: "@a" })];

    expect(findCreatorByHandle(creators, "b")).toBeUndefined();
  });
});
