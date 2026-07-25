import { beforeEach, describe, expect, it, vi } from "vitest";

// node 환경에 localStorage 없으므로 Map 기반 스텁 주입(persist 가 lazy 접근) — createSyncedStore.test.ts 선례.
const ls = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => {
    ls.set(k, v);
  },
  removeItem: (k: string) => {
    ls.delete(k);
  },
  clear: () => {
    ls.clear();
  },
});
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }));

import { seedInfluencerDemo } from "./seed";
import { creators } from "../store";
import { influencerCampaigns } from "@entities/influencer-campaign/store";

beforeEach(() => {
  ls.clear();
  creators.useStore.setState({ items: [], status: "idle", owner: null });
  influencerCampaigns.useStore.setState({ items: [], status: "idle", owner: null });
});

describe("seedInfluencerDemo", () => {
  it("크리에이터 3명 + 완료 캠페인 1개를 주입한다", () => {
    seedInfluencerDemo();
    expect(creators.useStore.getState().items).toHaveLength(3);
    expect(influencerCampaigns.useStore.getState().items).toHaveLength(1);
  });

  it("멱등 — 두 번 호출해도 개수가 늘지 않는다", () => {
    seedInfluencerDemo();
    seedInfluencerDemo();
    expect(creators.useStore.getState().items).toHaveLength(3);
    expect(influencerCampaigns.useStore.getState().items).toHaveLength(1);
  });

  it("유저가 만든 항목(비-시드 id)은 건드리지 않는다", () => {
    creators.useStore.getState().add({
      id: "user-created",
      handle: "@mine",
      platform: "instagram",
      category: [],
      performanceHistory: [],
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    seedInfluencerDemo();
    expect(creators.useStore.getState().items.some((c) => c.id === "user-created")).toBe(true);
    expect(creators.useStore.getState().items).toHaveLength(4);
  });
});
