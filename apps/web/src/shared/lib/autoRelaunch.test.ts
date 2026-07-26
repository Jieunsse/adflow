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

import { absorbLegacyAutoRelaunch, autoRelaunchStates, readAutoRelaunch } from "./autoRelaunch";

const fetchMock = vi.fn();

beforeEach(() => {
  ls.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  autoRelaunchStates.useStore.getState().setAll([]);
});

describe("absorbLegacyAutoRelaunch", () => {
  it("인덱스 없이 접두사 스캔으로 건져 올려요", () => {
    ls.set("auto-relaunch:c1", JSON.stringify({ campaignId: "c1", enabled: true, cycleCount: 2, createdAt: "x", updatedAt: "y" }));
    ls.set("auto-relaunch:c2", JSON.stringify({ campaignId: "c2", enabled: false, cycleCount: 1, createdAt: "x", updatedAt: "y" }));
    ls.set("adflow:other", "건드리면 안 됨");

    const absorbed = absorbLegacyAutoRelaunch();

    expect(absorbed.map((e) => e.campaignId).sort()).toEqual(["c1", "c2"]);
    expect(ls.has("auto-relaunch:c1")).toBe(false);
    // 접두사가 다른 키는 그대로 있어야 한다.
    expect(ls.get("adflow:other")).toBe("건드리면 안 됨");
  });

  it("깨진 JSON 은 건너뛰고 키만 지워요", () => {
    ls.set("auto-relaunch:bad", "{not json");
    expect(absorbLegacyAutoRelaunch()).toEqual([]);
    expect(ls.has("auto-relaunch:bad")).toBe(false);
  });
});

describe("readAutoRelaunch", () => {
  it("campaignId 로 동기 조회돼요", () => {
    autoRelaunchStates.useStore.getState().setAll([
      { campaignId: "c1", enabled: true, cycleCount: 3, createdAt: "x", updatedAt: "y" },
    ]);
    expect(readAutoRelaunch("c1")?.cycleCount).toBe(3);
    expect(readAutoRelaunch("없음")).toBeNull();
  });

  it("같은 campaignId 를 두 번 저장하면 하나만 남아요", () => {
    const store = autoRelaunchStates.useStore.getState();
    store.upsert({ campaignId: "c1", enabled: true, cycleCount: 1, createdAt: "x", updatedAt: "y" });
    store.upsert({ campaignId: "c1", enabled: false, cycleCount: 2, createdAt: "x", updatedAt: "z" });
    expect(autoRelaunchStates.useStore.getState().items).toHaveLength(1);
    expect(readAutoRelaunch("c1")?.enabled).toBe(false);
  });
});
