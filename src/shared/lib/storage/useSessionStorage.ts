import { useState, useEffect } from "react";

export function useSessionStorage(key: string, initialValue: string) {
  // SSR과 첫 클라이언트 렌더가 동일하게 initialValue를 사용해야 hydration 불일치 방지
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored !== null) setValue(stored);
    } catch {}
  }, [key]);

  const setAndPersist = (newValue: string) => {
    setValue(newValue);
    try {
      sessionStorage.setItem(key, newValue);
    } catch {}
  };

  return [value, setAndPersist] as const;
}
