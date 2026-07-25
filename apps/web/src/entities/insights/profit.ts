export function contributionMargin(
  conversionValue: number,
  conversionSpend: number,
  marginRate: number | null,
): number | null {
  if (marginRate == null) return null;
  return Math.round(conversionValue * marginRate - conversionSpend);
}

export function bepRoas(marginRate: number | null): number | null {
  if (marginRate == null || marginRate === 0) return null;
  return Math.round((1 / marginRate) * 100) / 100;
}
