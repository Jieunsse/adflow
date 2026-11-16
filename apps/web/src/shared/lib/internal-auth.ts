// Spring → Next 내부 호출의 자물쇠. server-side only.
//
// 반대 방향(Next → Spring)의 /internal/** 과 같은 규칙이다 — **미설정은 곧 잠금**. 설정값이 비었을 때
// 빈 헤더로 통과시키면 아무나 부를 수 있는 경로가 된다(단계 4 에서 Spring 쪽이 막은 구멍과 같은 부류).

import { timingSafeEqual } from "node:crypto";
import { internalSecret } from "@shared/lib/backend/client";

export function isInternalCall(req: { headers: { get(name: string): string | null } }): boolean {
  const secret = internalSecret();
  if (!secret) return false;
  const presented = Buffer.from(req.headers.get("x-internal-secret") ?? "");
  const expected = Buffer.from(secret);
  // 길이가 다르면 timingSafeEqual 이 던진다 — 먼저 거른다.
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}
