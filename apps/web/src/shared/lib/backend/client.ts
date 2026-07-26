// Spring 백엔드 호출의 단일 통로. server-side only — 내부 시크릿을 다룬다.
//
// 미설정이면 null 을 반환해 호출부가 조용히 건너뛴다. Supabase 클라이언트가 키 없을 때
// null 을 주던 것과 같은 계약이다. 배포 환경(백엔드 미배포)이 이 경로로 자동 휴면한다.

export function backendBaseUrl(): string | null {
  const raw = process.env.ADFLOW_BACKEND_URL;
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function internalSecret(): string | null {
  return process.env.ADFLOW_INTERNAL_SECRET ?? null;
}
