import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearGoalDraft, GOAL_DRAFT_STORAGE_KEY, loadGoalDraft, parseGoalDraft, saveGoalDraft } from "./goal-draft";

const store = new Map<string, string>();
vi.stubGlobal("window", {});
vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
});

const draft = { goalId: null, name: "신제품", metric: "cpa" as const, targetDraft: "13000", periodDays: 30 };

describe("goal-draft", () => {
  beforeEach(() => store.clear());

  it("같은 목표의 초안을 복원한다", () => {
    saveGoalDraft(draft);
    expect(loadGoalDraft(null)).toEqual(draft);
    expect(loadGoalDraft("other")).toBeNull();
  });

  it("깨진 초안은 무시하고 삭제할 수 있다", () => {
    store.set(GOAL_DRAFT_STORAGE_KEY, "{");
    expect(parseGoalDraft("{")).toBeNull();
    clearGoalDraft();
    expect(loadGoalDraft(null)).toBeNull();
  });
});
