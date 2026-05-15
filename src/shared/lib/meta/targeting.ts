// Meta spec: 1=male, 2=female, [] or [1,2] = all (unspecified).

export type Gender = "all" | "male" | "female";

export function gendersToUi(genders: number[]): Gender {
  if (genders.length === 1) return genders[0] === 1 ? "male" : "female";
  return "all";
}

export function uiToGenders(g: Gender): number[] {
  return g === "male" ? [1] : g === "female" ? [2] : [];
}
