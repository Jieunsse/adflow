export type CreateFlowStep = 0 | 1 | 2;

export type CreateFlowRoute = {
  step: CreateFlowStep;
  reviewing: boolean;
};

export function routeFromCreateStage(stage: string | null): CreateFlowRoute {
  switch (stage) {
    case "creative": return { step: 1, reviewing: false };
    case "delivery": return { step: 2, reviewing: false };
    case "review": return { step: 2, reviewing: true };
    default: return { step: 0, reviewing: false };
  }
}

export function createStageFor(step: CreateFlowStep, reviewing: boolean): string | null {
  if (reviewing) return "review";
  if (step === 1) return "creative";
  if (step === 2) return "delivery";
  return null;
}
