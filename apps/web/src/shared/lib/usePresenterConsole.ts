"use client";

// Browse Mode 발표자 콘솔(빨리감기 바)의 전역 표시 on/off. 사이드바 마스터 스위치가 토글하고,
// 페이지별 Presenter 바가 이 값을 구독해 표시를 단락한다. useScopedStorage 로 컴포넌트 간 동기화.

import { useScopedStorage } from "./storage/useScopedStorage";

const KEY = "adflow:presenter-console";

export function usePresenterConsole() {
  return useScopedStorage<boolean>("local", KEY, true);
}
