import { describe, expect, it } from "vitest";
import {
  BASE_INTERVAL_MS,
  IDLE_INTERVAL_MS,
  INITIAL_BACKOFF,
  applyResult,
  isIdle,
  nextInterval,
} from "./ad-status-interval";

describe("isIdle", () => {
  it("빈 snapshot = idle", () => {
    expect(isIdle([])).toBe(true);
  });
  it("ACTIVE + PAUSED 만 = idle", () => {
    expect(isIdle(["ACTIVE", "PAUSED", "ACTIVE"])).toBe(true);
  });
  it("PENDING_REVIEW 하나라도 있으면 not idle", () => {
    expect(isIdle(["ACTIVE", "PENDING_REVIEW"])).toBe(false);
  });
  it("WITH_ISSUES 있으면 not idle", () => {
    expect(isIdle(["ACTIVE", "WITH_ISSUES"])).toBe(false);
  });
  it("DISAPPROVED 있으면 not idle", () => {
    expect(isIdle(["DISAPPROVED"])).toBe(false);
  });
});

describe("nextInterval", () => {
  it("active+pending = base × 1", () => {
    expect(nextInterval(["ACTIVE", "PENDING_REVIEW"], INITIAL_BACKOFF)).toBe(BASE_INTERVAL_MS);
  });
  it("active only = idle × 1", () => {
    expect(nextInterval(["ACTIVE"], INITIAL_BACKOFF)).toBe(IDLE_INTERVAL_MS);
  });
  it("base × multiplier 4", () => {
    expect(nextInterval(["PENDING_REVIEW"], { consecutiveFails: 5, multiplier: 4 })).toBe(BASE_INTERVAL_MS * 4);
  });
});

describe("applyResult", () => {
  it("성공 = INITIAL 복구", () => {
    const r = applyResult({ consecutiveFails: 5, multiplier: 4 }, true);
    expect(r).toEqual(INITIAL_BACKOFF);
  });
  it("실패 누적 → 3회에 ×2", () => {
    let b = INITIAL_BACKOFF;
    b = applyResult(b, false);
    b = applyResult(b, false);
    expect(b.multiplier).toBe(1);
    b = applyResult(b, false);
    expect(b.multiplier).toBe(2);
  });
  it("실패 5회 → ×4", () => {
    let b = INITIAL_BACKOFF;
    for (let i = 0; i < 5; i++) b = applyResult(b, false);
    expect(b.multiplier).toBe(4);
    expect(b.consecutiveFails).toBe(5);
  });
});
