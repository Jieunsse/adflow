import type { Viewport } from "next";
import GoalsClient from "./GoalsClient";

// 목표 화면은 모바일까지 대응한다 — 워크스페이스 레이아웃의 1440 고정을 여기서만 푼다.
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function GoalsPage() {
  return <GoalsClient />;
}
