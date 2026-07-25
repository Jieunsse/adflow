"use client";

// 계정 다중 목표 read/write — 활성 브랜드 프로필의 goals 필드에 위임(신규 스토어 없음).
// 레거시 단일 goal 필드는 읽기 파생 뷰로만 흡수하고, 첫 mutation 시 goals 로 영속된다.

import { useCallback, useMemo } from "react";
import type { Goal } from "@entities/insights/goal";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import {
  readActiveBrandProfileEntry,
  type BrandProfileEntry,
} from "@features/brand-profile/model/useBrandProfileStorage";
import { upsertProfile } from "@features/brand-profile/model/brandProfileStore";

export function deriveGoals(profile: { goals?: Goal[]; goal?: Goal["lag"] }): Goal[] {
  if (profile.goals) return profile.goals;
  if (profile.goal) {
    return [{ id: "legacy", name: "기존 목표", lag: profile.goal, leads: [], createdAt: "" }];
  }
  return [];
}

export function useGoalsStorage(seedDemo = false): {
  goals: Goal[];
  marginRate: number | null;
  addGoal: (goal: Goal) => void;
  updateGoal: (goal: Goal) => void;
  removeGoal: (id: string) => void;
  hasProfile: boolean;
} {
  const { profile, activeId } = useBrandProfileStorage(seedDemo);

  const goals = useMemo(() => deriveGoals(profile), [profile]);

  const persist = useCallback((next: Goal[]) => {
    const entry: BrandProfileEntry | null = readActiveBrandProfileEntry();
    if (!entry) return;
    upsertProfile({ ...entry, goals: next });
  }, []);

  const addGoal = useCallback(
    (goal: Goal) => {
      persist([...deriveGoals(readActiveBrandProfileEntry() ?? {}), goal]);
    },
    [persist],
  );

  const updateGoal = useCallback(
    (goal: Goal) => {
      const current = deriveGoals(readActiveBrandProfileEntry() ?? {});
      persist(current.map((g) => (g.id === goal.id ? goal : g)));
    },
    [persist],
  );

  const removeGoal = useCallback(
    (id: string) => {
      const current = deriveGoals(readActiveBrandProfileEntry() ?? {});
      persist(current.filter((g) => g.id !== id));
    },
    [persist],
  );

  return {
    goals,
    marginRate: profile.marginRate ?? null,
    addGoal,
    updateGoal,
    removeGoal,
    hasProfile: activeId != null,
  };
}
