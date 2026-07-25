import type { AdEffectiveStatus } from "./ad-status-diff";

export const BASE_INTERVAL_MS = 2 * 60 * 1000;
export const IDLE_INTERVAL_MS = 10 * 60 * 1000;

export interface ErrorBackoff {
  consecutiveFails: number;
  multiplier: number;
}

export const INITIAL_BACKOFF: ErrorBackoff = { consecutiveFails: 0, multiplier: 1 };

export function isIdle(statuses: AdEffectiveStatus[]): boolean {
  if (statuses.length === 0) return true;
  return statuses.every((s) => s === "ACTIVE" || s === "PAUSED");
}

export function nextInterval(statuses: AdEffectiveStatus[], backoff: ErrorBackoff): number {
  const base = isIdle(statuses) ? IDLE_INTERVAL_MS : BASE_INTERVAL_MS;
  return base * backoff.multiplier;
}

export function applyResult(backoff: ErrorBackoff, success: boolean): ErrorBackoff {
  if (success) return { ...INITIAL_BACKOFF };
  const consecutiveFails = backoff.consecutiveFails + 1;
  let multiplier = backoff.multiplier;
  if (consecutiveFails >= 5) multiplier = 4;
  else if (consecutiveFails >= 3) multiplier = 2;
  return { consecutiveFails, multiplier };
}
