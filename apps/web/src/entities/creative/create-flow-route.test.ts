import { describe, expect, it } from "vitest";
import { createStageFor, routeFromCreateStage } from "./create-flow-route";

describe("create flow route", () => {
  it("URL 단계와 화면 상태를 서로 변환한다", () => {
    expect(routeFromCreateStage("creative")).toEqual({ step: 1, reviewing: false });
    expect(routeFromCreateStage("delivery")).toEqual({ step: 2, reviewing: false });
    expect(routeFromCreateStage("review")).toEqual({ step: 2, reviewing: true });
    expect(routeFromCreateStage("unknown")).toEqual({ step: 0, reviewing: false });
    expect(createStageFor(0, false)).toBeNull();
    expect(createStageFor(1, false)).toBe("creative");
    expect(createStageFor(2, false)).toBe("delivery");
    expect(createStageFor(2, true)).toBe("review");
  });
});
