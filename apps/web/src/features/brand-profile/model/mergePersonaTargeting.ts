import type { ExtractedTargeting } from "@/lib/gemini-creative";
import type { PersonaEntry } from "./usePersonasStorage";

// ADR-022 — 페르소나의 연령·성별은 "명시 시 override / 비우면 AI 추천".
// genders: undefined = AI 추천, [] = 전체 명시(override), [1]/[2] = 남/여 override.
export type TargetingSource = { age: "persona" | "ai"; gender: "persona" | "ai" };

export interface MergedTargeting {
  targeting: ExtractedTargeting;
  source: TargetingSource;
}

export function mergePersonaTargeting(
  ai: ExtractedTargeting,
  persona?: Pick<PersonaEntry, "ageMin" | "ageMax" | "genders">,
): MergedTargeting {
  const ageOverride = persona?.ageMin != null && persona?.ageMax != null;
  const genderOverride = persona?.genders != null;
  return {
    targeting: {
      ageMin: ageOverride ? persona!.ageMin! : ai.ageMin,
      ageMax: ageOverride ? persona!.ageMax! : ai.ageMax,
      genders: genderOverride ? persona!.genders! : ai.genders,
    },
    source: {
      age: ageOverride ? "persona" : "ai",
      gender: genderOverride ? "persona" : "ai",
    },
  };
}
