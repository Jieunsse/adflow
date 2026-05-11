"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

const MAINTENANCE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true"

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Meta 앱 연결 중 오류가 발생했어요. Meta 개발자 계정이 일시 정지됐을 수 있어요.",
  OAuthCallback: "Meta 앱 연결 중 오류가 발생했어요. Meta 개발자 계정이 일시 정지됐을 수 있어요.",
  OAuthAccountNotLinked: "이미 다른 방식으로 가입된 계정이에요.",
  AccessDenied: "앱 접근이 거부됐어요. 테스터로 등록된 계정인지 확인해주세요.",
  Default: "로그인 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.",
}

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default) : null

  if (error) {
    console.error("[AdFlow][login] NextAuth error code:", error, "| URL:", window.location.href)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-5)",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "var(--space-8) var(--space-6)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-5)",
          textAlign: "center",
        }}
      >
        <a className="logo" href="#" style={{ fontSize: "22px" }}>
          <span className="logo__dot" />
          <span>AdFlow</span>
        </a>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-md)",
              fontWeight: 600,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            마케터를 위한 AI 광고 자동화
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            Meta 광고 계정으로 로그인하면<br />
            AI가 소재 제작부터 집행, 성과 분석까지 도와드려요.
          </p>
        </div>

        {MAINTENANCE ? (
          <div
            style={{
              width: "100%",
              padding: "var(--space-4)",
              borderRadius: "8px",
              background: "var(--surface-2, #f5f5f5)",
              border: "1px solid var(--border, #e0e0e0)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
              현재 서비스 점검 중이에요
            </p>
            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Meta 연동 관련 작업이 진행 중이에요.<br />
              완료 후 다시 로그인할 수 있어요.
            </p>
          </div>
        ) : (
          <>
            {errorMessage && (
              <div
                style={{
                  width: "100%",
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "8px",
                  background: "#fff3f3",
                  border: "1px solid #fca5a5",
                }}
              >
                <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "#b91c1c", lineHeight: 1.6 }}>
                  {errorMessage}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "#b91c1c", opacity: 0.6 }}>
                  에러 코드: {error}
                </p>
              </div>
            )}

            <button
              className="btn btn--primary"
              style={{ width: "100%", padding: "14px 24px", fontSize: "var(--text-md)" }}
              onClick={() => signIn("facebook", { callbackUrl: "/setup" })}
            >
              Facebook으로 로그인
            </button>

            <p
              style={{
                margin: 0,
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                lineHeight: 1.6,
              }}
            >
              로그인 시 광고 계정 접근 권한을 요청해요.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
