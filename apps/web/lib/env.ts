// Server-side only — runtime env 가드. 부팅·핸들러 진입 시점에 호출해서
// 필수 환경 변수가 비어있으면 명시적인 에러로 빠르게 실패시켜요.
//
// META_CLIENT_ID / META_CLIENT_SECRET 은 마법사로 입력받을 수 있으니 여기서 강제 안 함.

const REQUIRED = ["NEXTAUTH_SECRET", "NEXTAUTH_URL"] as const

export function assertRequiredEnv(): void {
  const missing = REQUIRED.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(
      `필수 환경 변수가 비어있어요: ${missing.join(", ")}. .env.local 또는 배포 환경을 확인해주세요.`,
    )
  }
}

// Meta 테스트 광고 계정 치환. dev 모드 + NEXT_PUBLIC_META_TEST_AD_ACCOUNT_ID 셋팅 시
// session.adAccountId 대신 테스트 계정 id 를 사용해서 Marketing API 전체 플로우
// (Campaign → AdSet → AdCreative → Ad) 를 실제로 호출. 노출·과금 없음.
// production 빌드에서는 무조건 session 값 사용 — 실수로 dev 변수가 남아도 안전.
export function resolveAdAccountId(sessionAdAccountId: string): string {
  if (process.env.NEXT_PUBLIC_META_APP_MODE !== "development") return sessionAdAccountId
  const testId = process.env.NEXT_PUBLIC_META_TEST_AD_ACCOUNT_ID?.trim()
  if (!testId) return sessionAdAccountId
  return testId.startsWith("act_") ? testId : `act_${testId}`
}

export function resolveAccessToken(sessionAccessToken: string): string {
  if (process.env.NEXT_PUBLIC_META_APP_MODE !== "development") return sessionAccessToken
  const testToken = process.env.META_TEST_ACCESS_TOKEN?.trim()
  return testToken || sessionAccessToken
}
