import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/lib/supabase-sync", () => ({
  syncUpsert: vi.fn(),
  syncDelete: vi.fn(),
}));

// node 환경에 localStorage 없으므로 Map 기반 스텁 주입
const ls = new Map<string, string>();
vi.stubGlobal("window", {});
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

import type { Goal } from "@entities/insights/goal";
import {
  brandProfiles,
  upsertProfile,
} from "@features/brand-profile/model/brandProfileStore";
import {
  readActiveBrandProfileEntry,
  type BrandProfileEntry,
} from "@features/brand-profile/model/useBrandProfileStorage";

import { deriveGoals } from "./useGoalsStorage";

const ACTIVE_ID_KEY = "adflow:brand-profile:active-id";

function setActiveProfile(entry: BrandProfileEntry) {
  brandProfiles.useStore.getState().setAll([entry]);
  localStorage.setItem(ACTIVE_ID_KEY, entry.id);
}

const baseEntry: BrandProfileEntry = { id: "bp1", name: "테스트 브랜드" };

beforeEach(() => {
  ls.clear();
});

describe("deriveGoals — 읽기 파생 뷰", () => {
  it("goals 도 goal 도 없으면 빈 배열", () => {
    expect(deriveGoals(baseEntry)).toEqual([]);
  });

  it("레거시 goal만 있으면 goals 파생 뷰 1개(id legacy)", () => {
    const entry = { ...baseEntry, goal: { metric: "roas" as const, target: 4 } };
    const goals = deriveGoals(entry);
    expect(goals).toHaveLength(1);
    expect(goals[0]).toEqual({
      id: "legacy",
      name: "기존 목표",
      lag: { metric: "roas", target: 4 },
      leads: [],
      createdAt: "",
    });
  });

  it("goals 가 있으면 그대로 반환", () => {
    const g: Goal = {
      id: "g1",
      name: "커스텀 목표",
      lag: { metric: "cpa", target: 15_000 },
      leads: [],
      createdAt: "2026-01-01",
    };
    expect(deriveGoals({ ...baseEntry, goals: [g] })).toEqual([g]);
  });
});

describe("useGoalsStorage 쓰기 경로 — upsertProfile 위임", () => {
  it("addGoal: 레거시 goal 흡수 + 신규 goal 영속", () => {
    setActiveProfile({ ...baseEntry, goal: { metric: "roas", target: 4 } });

    const entry = readActiveBrandProfileEntry();
    expect(entry).not.toBeNull();
    const current = deriveGoals(entry!);
    const newGoal: Goal = {
      id: "g2",
      name: "신규 목표",
      lag: { metric: "cpa", target: 10_000 },
      leads: [],
      createdAt: "2026-07-05",
    };
    upsertProfile({ ...entry!, goals: [...current, newGoal] });

    const after = readActiveBrandProfileEntry();
    expect(after?.goals).toHaveLength(2);
    expect(after?.goals?.[0].id).toBe("legacy");
    expect(after?.goals?.[1]).toEqual(newGoal);
    expect(after?.goal).toEqual({ metric: "roas", target: 4 });
  });

  it("updateGoal: id 매칭 교체", () => {
    const g1: Goal = { id: "g1", name: "A", lag: { metric: "roas", target: 4 }, leads: [], createdAt: "2026-01-01" };
    const g2: Goal = { id: "g2", name: "B", lag: { metric: "cpa", target: 10_000 }, leads: [], createdAt: "2026-01-02" };
    setActiveProfile({ ...baseEntry, goals: [g1, g2] });

    const entry = readActiveBrandProfileEntry()!;
    const updated: Goal = { ...g2, name: "B-수정" };
    const next = deriveGoals(entry).map((g) => (g.id === updated.id ? updated : g));
    upsertProfile({ ...entry, goals: next });

    const after = readActiveBrandProfileEntry();
    expect(after?.goals).toEqual([g1, updated]);
  });

  it("removeGoal: id 로 제거", () => {
    const g1: Goal = { id: "g1", name: "A", lag: { metric: "roas", target: 4 }, leads: [], createdAt: "2026-01-01" };
    const g2: Goal = { id: "g2", name: "B", lag: { metric: "cpa", target: 10_000 }, leads: [], createdAt: "2026-01-02" };
    setActiveProfile({ ...baseEntry, goals: [g1, g2] });

    const entry = readActiveBrandProfileEntry()!;
    const next = deriveGoals(entry).filter((g) => g.id !== "g1");
    upsertProfile({ ...entry, goals: next });

    const after = readActiveBrandProfileEntry();
    expect(after?.goals).toEqual([g2]);
  });
});
