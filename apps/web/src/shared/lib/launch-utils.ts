export function calcPeriod(start: string, end: string) {
  const s = new Date(start), e = new Date(end)
  if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
    const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1
    return { days, min: Math.round(days * 1.6), max: Math.round(days * 2.4) }
  }
  return { days: 7, min: 11, max: 17 }
}

export function fmtBudget(v: string): string {
  return v.replace(/[^\d]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
