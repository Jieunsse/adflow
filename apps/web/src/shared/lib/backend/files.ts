// 버킷 파일의 경로↔URL 변환. 순수 함수라 서버·클라 어디서든 쓴다.
//
// DB 에는 상대 경로만 산다(설계 §5). 노출 URL 을 여기서 조립하므로 호스팅이 바뀌어도
// DB 마이그레이션이 필요 없다.

const PUBLIC_PREFIX = "/api/files/";

/** 저장 경로 → 브라우저가 쓸 URL. 이미 URL 인 값은 건드리지 않는다. */
export function toPublicUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  // data: 는 게스트 폴백, http 는 이관 전 Supabase public URL, / 는 데모 시드.
  if (path.startsWith("data:") || path.startsWith("http") || path.startsWith("/")) return path;
  return PUBLIC_PREFIX + path;
}

/** 노출 URL → 저장 경로. 클라가 되돌려 보낸 imageUrl 을 다시 DB 에 넣을 때 쓴다. */
export function toStoragePath(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith(PUBLIC_PREFIX) ? url.slice(PUBLIC_PREFIX.length) : url;
}
