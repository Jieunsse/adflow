import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createStageFor, routeFromCreateStage, type CreateFlowStep } from "@entities/creative/create-flow-route";

export function useCreateFlowRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<CreateFlowStep>(0);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    const route = routeFromCreateStage(searchParams.get("stage"));
    // URL 변경 직후 화면을 맞추는 동기화 상태다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(route.step);
    setReviewing(route.reviewing);
  }, [searchParams]);

  function goToStep(nextStep: CreateFlowStep, nextReviewing = false) {
    setStep(nextStep);
    setReviewing(nextReviewing);
    const params = new URLSearchParams(searchParams.toString());
    const stage = createStageFor(nextStep, nextReviewing);
    if (stage) params.set("stage", stage);
    else params.delete("stage");
    const query = params.toString();
    router.push(query ? `/create?${query}` : "/create");
  }

  return { searchParams, router, step, reviewing, setStep, setReviewing, goToStep };
}
