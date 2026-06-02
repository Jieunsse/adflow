// Owner Key (ADR-046 결정 2) — cross-device 데이터 소유자 식별 키 = NextAuth session.user.email.
// 안정적 user.id 부재로 세 provider(Facebook·Credentials·axhub) 공통분모인 email 을 단일 키로 쓴다.
// guest@adflow.local = 영속 제외 sentinel: Supabase 읽기/쓰기를 단락해 ADR-033(Browse=localStorage)을 자동 충족.
// pure 모듈("use client" 아님) — 서버 라우트와 클라 store 양쪽에서 import.

export const GUEST_OWNER = "guest@adflow.local";

// 실유저(Supabase 백킹 대상) 여부. 게스트 sentinel·미로그인(null)은 false → API 단락(localStorage 만).
export function isRealOwner(email: string | null | undefined): email is string {
  return !!email && email !== GUEST_OWNER;
}
