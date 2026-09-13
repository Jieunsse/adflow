import { useEffect, useState } from "react";
import type { CreativeState } from "@entities/creative/model";
import type { LaunchState } from "@entities/campaign/model";
import { clearDraftFromSession, saveDraftToSession, type StudioSnapshot } from "@entities/creative/draft-persistence";
import { shrinkImageDataUrl } from "@shared/lib/shrink-image";
import type { CreateDraftSnapshot } from "@entities/creative/draft-persistence";

export function useCreateDraftPersistence({
  step,
  creative,
  launch,
  studio,
  resumeDraft,
  draftResolved,
}: {
  step: 0 | 1 | 2;
  creative: CreativeState;
  launch: LaunchState;
  studio: StudioSnapshot;
  resumeDraft: CreateDraftSnapshot | null;
  draftResolved: boolean;
}) {
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!draftResolved || resumeDraft) return;
    if (launch.launchedCampaign) {
      clearDraftFromSession();
      return;
    }
    const meaningful = step > 0 || creative.outcome !== null || studio.displayedHeadlines !== null;
    if (!meaningful) return;
    const timer = setTimeout(() => {
      void (async () => {
        const [img, finalImg] = await Promise.all([
          launch.imageDataUrl ? shrinkImageDataUrl(launch.imageDataUrl) : Promise.resolve(null),
          launch.finalImageDataUrl ? shrinkImageDataUrl(launch.finalImageDataUrl) : Promise.resolve(null),
        ]);
        saveDraftToSession(step, creative, { ...launch, imageDataUrl: img, finalImageDataUrl: finalImg }, studio);
        setLastSavedAt(Date.now());
      })();
    }, 800);
    return () => clearTimeout(timer);
  }, [step, creative, launch, studio, resumeDraft, draftResolved]);

  useEffect(() => {
    if (!draftResolved || resumeDraft) return;
    const saveBeforeLeave = () => {
      if (launch.launchedCampaign) {
        clearDraftFromSession();
        return;
      }
      const meaningful = step > 0 || creative.outcome !== null || studio.displayedHeadlines !== null;
      if (meaningful) saveDraftToSession(step, creative, launch, studio);
    };
    window.addEventListener("pagehide", saveBeforeLeave);
    return () => window.removeEventListener("pagehide", saveBeforeLeave);
  }, [step, creative, launch, studio, resumeDraft, draftResolved]);

  return { lastSavedAt };
}
