export function calcDaysBetween(startISO: string, endISO: string, fallback = 7): number {
  const a = new Date(startISO);
  const b = new Date(endISO);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return fallback;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

/**
 * Magic numbers (600/300) are KRW-based CPM assumptions — rough placeholder.
 * A future pass will calibrate against the account's historical CPM and industry benchmarks.
 */
export function estimateImpressionRange(
  dailyBudgetKRW: number,
  days: number,
): { min: number; max: number } {
  const totalBudget = dailyBudgetKRW * days;
  return {
    min: Math.round(totalBudget / 600 / 100) * 100,
    max: Math.round(totalBudget / 300 / 100) * 100,
  };
}
