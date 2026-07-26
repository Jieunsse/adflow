// 실 유저 토너먼트 조립점 (ADR-038) — server-side only. Spring store + Meta 게재 어댑터로
// 서버 오케스트레이터를 만든다. cron 폴러·API 라우트가 이 한 곳에서 같은 러너를 얻는다.
//
// 단계 6 — 영속·판정·게재·자동 진행이 전부 Spring 으로 넘어갔다. 여기 남은 TS 는 토너먼트 생성과
// 챔피언 확정처럼 세션이 있어야 하는 편집뿐이다. 게재가 얽힌 액션은 advanceOnBackend 가 Java 를 부른다.

import { createHash } from "node:crypto";
import { createServerRunner, type ServerRunner } from "./server-runner";
import { backendTournamentStore } from "./backend-store";

export function getRealTournamentRunner(): ServerRunner {
  return createServerRunner({ store: backendTournamentStore });
}

// 소유 매칭 키 — 세션 email 우선, 없으면(Facebook provider 가 email scope 미보유) 토큰 해시 폴백.
// SSE registry 의 hashToken 과 동일 길이라 cron push 대상과 일관.
export function ownerKeyFrom(email: string | null | undefined, accessToken: string): string {
  if (email && email !== "guest@adflow.local") return email;
  return createHash("sha256").update(accessToken).digest("hex").slice(0, 24);
}

export { backendTournamentStore as tournamentStore, advanceOnBackend } from "./backend-store";
