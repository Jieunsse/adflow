import { beforeEach, describe, expect, it, vi } from "vitest";

const ls = new Map<string, string>();
vi.stubGlobal("window", {});
vi.stubGlobal("localStorage", {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => { ls.set(k, v); },
  removeItem: (k: string) => { ls.delete(k); },
  clear: () => { ls.clear(); },
  get length() { return ls.size; },
  key: (i: number) => [...ls.keys()][i] ?? null,
});

import {
  absorbLegacyLaunches,
  campaignLaunches,
  loadLaunchedCampaign,
  saveLaunchedCampaign,
} from "./launched-storage";

const fetchMock = vi.fn();

function launched(campaignId: string) {
  return {
    campaignId,
    adSetId: "adset_1",
    dailyBudget: 10000,
    startDate: "2026-07-01",
    endDate: "2026-07-07",
    status: "ACTIVE" as const,
  };
}

beforeEach(() => {
  ls.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  campaignLaunches.useStore.getState().setAll([]);
});

describe("absorbLegacyLaunches", () => {
  it("adflow:launched: 접두사를 스캔해 흡수해요", () => {
    ls.set("adflow:launched:c1", JSON.stringify(launched("c1")));
    ls.set("adflow:launched:c2", JSON.stringify(launched("c2")));
    ls.set("adflow:library", "건드리면 안 됨");

    expect(absorbLegacyLaunches().map((l) => l.campaignId).sort()).toEqual(["c1", "c2"]);
    expect(ls.has("adflow:launched:c1")).toBe(false);
    expect(ls.get("adflow:library")).toBe("건드리면 안 됨");
  });
});

describe("loadLaunchedCampaign", () => {
  it("동기로 campaignId 조회돼요", () => {
    campaignLaunches.useStore.getState().setAll([launched("c1")]);
    expect(loadLaunchedCampaign("c1")?.adSetId).toBe("adset_1");
    expect(loadLaunchedCampaign("없음")).toBeNull();
  });

  it("저장하면 바로 읽혀요 — 게재 직후 결과 카드가 이 경로다", () => {
    saveLaunchedCampaign(launched("c9"));
    expect(loadLaunchedCampaign("c9")?.campaignId).toBe("c9");
  });
});
