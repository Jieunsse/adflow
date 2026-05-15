import { useCallback, useRef, useState } from "react";

const AGE_MIN_BOUND = 18;
const AGE_MAX_BOUND = 65;
const AGE_RANGE = AGE_MAX_BOUND - AGE_MIN_BOUND; // 47

const clampAge = (v: number) => Math.max(AGE_MIN_BOUND, Math.min(AGE_MAX_BOUND, Math.round(v)));

export function useAgeSlider(initialMin = 25, initialMax = 44) {
  const [ageMin, setAgeMin] = useState(initialMin);
  const [ageMax, setAgeMax] = useState(initialMax);
  const trackRef = useRef<HTMLDivElement>(null);

  const ageMinPct = ((ageMin - AGE_MIN_BOUND) / AGE_RANGE) * 100;
  const ageMaxPct = ((ageMax - AGE_MIN_BOUND) / AGE_RANGE) * 100;

  const dragThumb =
    (which: "min" | "max") => (e: React.PointerEvent<HTMLDivElement>) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(
        0,
        Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
      );
      const age = Math.round(AGE_MIN_BOUND + (pct / 100) * AGE_RANGE);
      if (which === "min") setAgeMin(Math.min(age, ageMax - 1));
      else setAgeMax(Math.max(age, ageMin + 1));
    };

  const setRange = useCallback((min: number, max: number) => {
    const lo = clampAge(min);
    const hi = clampAge(max);
    if (lo < hi) {
      setAgeMin(lo);
      setAgeMax(hi);
    }
  }, []);

  return { ageMin, ageMax, ageMinPct, ageMaxPct, trackRef, dragThumb, setRange };
}
