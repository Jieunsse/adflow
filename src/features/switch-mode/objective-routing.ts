import type { MetaObjective } from "@entities/creative/options";
import type { LaunchMode } from "@entities/campaign/model";

/**
 * Returns the mode to auto-switch to on STEP 02 entry, or null to keep the current mode.
 * Non-traffic objectives recommend "detailed" so the campaign goal is visible.
 */
export function autoModeFromObjective(objective: MetaObjective | null): LaunchMode | null {
  if (!objective) return null;
  if (objective === "OUTCOME_TRAFFIC") return null;
  return "detailed";
}
