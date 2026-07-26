// 실 유저 토너먼트 조립점 (ADR-038) — server-side only. Spring store + Meta 게재 어댑터로
// 서버 오케스트레이터를 만든다. cron 폴러·API 라우트가 이 한 곳에서 같은 러너를 얻는다.
//
// 단계 5 — 영속과 라운드 판정이 Spring 으로 넘어갔다. 여기 남은 TS 는 게재·크리에이티브 생성뿐이고,
// 결산은 settleRoundOnBackend 가 Java 엔진을 부른다(설계 §9).

import { createHash } from "node:crypto";
import { createServerRunner, type ServerRunner } from "./server-runner";
import { backendTournamentStore } from "./backend-store";
import { createMetaRoundLauncher } from "./meta-launcher";

export function getRealTournamentRunner(): ServerRunner {
  return createServerRunner({
    store: backendTournamentStore,
    launcher: createMetaRoundLauncher(),
  });
}

// 소유 매칭 키 — 세션 email 우선, 없으면(Facebook provider 가 email scope 미보유) 토큰 해시 폴백.
// SSE registry 의 hashToken 과 동일 길이라 cron push 대상과 일관.
export function ownerKeyFrom(email: string | null | undefined, accessToken: string): string {
  if (email && email !== "guest@adflow.local") return email;
  return createHash("sha256").update(accessToken).digest("hex").slice(0, 24);
}

export { backendTournamentStore as tournamentStore, settleRoundOnBackend } from "./backend-store";
