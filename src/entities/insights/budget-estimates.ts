export function calcDaysBetween(startISO: string, endISO: string, fallback = 7): number {
  const a = new Date(startISO);
  const b = new Date(endISO);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return fallback;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

/**
 * CPM_HIGH/CPM_LOW are KRW-based CPM assumptions — rough placeholder.
 * A future pass will calibrate against the account's historical CPM and industry benchmarks.
 */
const CPM_HIGH = 8000;
const CPM_LOW = 3000;

export function estimateImpressionRange(
  dailyBudgetKRW: number,
  days: number,
): { min: number; max: number } {
  const totalBudget = dailyBudgetKRW * days;
  return {
    min: Math.round((totalBudget / CPM_HIGH) * 1000 / 100) * 100,
    max: Math.round((totalBudget / CPM_LOW) * 1000 / 100) * 100,
  };
}
