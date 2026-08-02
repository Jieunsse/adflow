export type SuggestionAction =
  | { kind: "ai-draft" }
  | { kind: "boost-post"; igMediaId: string }
  | { kind: "create-campaign" };

export type Suggestion =
  | { kind: "pause"; severity: "warn"; title: string; detail: string[]; action?: SuggestionAction }
  | { kind: "fake-performance"; severity: "warn"; title: string; detail: string[]; action?: SuggestionAction }
  | { kind: "increase-budget"; severity: "info"; title: string; detail: string[]; fromDailyBudget: number; toDailyBudget: number; action?: SuggestionAction }
  | { kind: "note"; severity: "info" | "warn"; title: string; detail: string[]; action?: SuggestionAction };
