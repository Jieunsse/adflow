"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Icon from "@shared/ui/Icon";

const MAINTENANCE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Meta 앱 연결 중 오류가 발생했어요. Meta 개발자 계정이 일시 정지됐을 수 있어요.",
  OAuthCallback: "Meta 앱 연결 중 오류가 발생했어요. Meta 개발자 계정이 일시 정지됐을 수 있어요.",
  OAuthAccountNotLinked: "이미 다른 방식으로 가입된 계정이에요.",
  AccessDenied: "앱 접근이 거부됐어요. 테스터로 등록된 계정인지 확인해주세요.",
  Default: "로그인 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.",
};

function LoginStat({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.10)", borderRadius: 12, padding: "14px 14px", backdropFilter: "blur(6px)" }}>
      <div style={{ font: "800 22px/1 var(--w-font-display)", color: "#fff", letterSpacing: "-0.02em" }}>{v}</div>
      <div style={{ font: "500 11.5px/1.3 var(--w-font-sans)", color: "rgba(255,255,255,0.75)", marginTop: 6 }}>{k}</div>
    </div>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default) : null;
  const [loading, setLoading] = useState(false);

  if (errorCode && typeof window !== "undefined") {
    console.error("[AdFlow][login] NextAuth error code:", errorCode, "| URL:", window.location.href);
  }

  function handleLogin() {
    setLoading(true);
    signIn("facebook", { callbackUrl: "/dashboard" });
  }

  function handleBrowse() {
    setLoading(true);
    signIn("guest", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="adflow">
      <div className="login-shell" data-screen-label="로그인">
        <aside className="login-art">
          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)", display: "grid", placeItems: "center", color: "#fff", font: "800 16px/1 var(--w-font-display)", letterSpacing: "-0.03em" }}>A</div>
            <span style={{ font: "800 18px/1 var(--w-font-display)", color: "#fff", letterSpacing: "-0.022em" }}>AdFlow</span>
          </div>

          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 28 }}>
            <span style={{ font: "600 11px/1 var(--w-font-sans)", textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.72)" }}>오늘의 캠페인</span>
            <div style={{ font: "800 38px/1.25 var(--w-font-display)", color: "#fff", letterSpacing: "-0.024em" }}>
              AI가 만든 카피로<br />
              첫 주에 CTR<br />
              <span style={{ color: "#9cd4ff" }}>2.1% → 3.4%</span>
            </div>
            <p style={{ font: "500 14.5px/1.6 var(--w-font-sans)", color: "rgba(255,255,255,0.84)", maxWidth: 380, margin: 0 }}>
              제품 정보만 입력하면 헤드라인·타겟팅·예산 분배까지 — AdFlow가 마케터의 12분을 만들어요.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, maxWidth: 420 }}>
              <LoginStat k="이번 주 집행" v="2,847" />
              <LoginStat k="평균 CTR ↑" v="+38%" />
              <LoginStat k="집행까지" v="12분" />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.20)", display: "grid", placeItems: "center", color: "#fff", font: "700 13px/1 var(--w-font-sans)" }}>최</div>
            <div>
              <div style={{ font: "700 13px/1.3 var(--w-font-sans)", color: "#fff" }}>최지은 · 그로스 마케터</div>
              <div style={{ font: "500 12px/1.3 var(--w-font-sans)", color: "rgba(255,255,255,0.7)" }}>콜드브루 오리지널 캠페인 운영 중</div>
            </div>
          </div>
        </aside>

        <section className="login-side">
          <div style={{ maxWidth: 380, width: "100%" }}>
            <span className="w-overline" style={{ color: "var(--w-primary-normal)", fontSize: 11, letterSpacing: "0.12em" }}>Marketing AI · 광고 자동화</span>
            <h1 style={{ font: "800 32px/1.25 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.024em", margin: "12px 0 10px" }}>
              마케터를 위한<br />AI 광고 자동화
            </h1>
            <p style={{ font: "500 14px/1.6 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "0 0 28px" }}>
              제품 정보만 입력하면 AI가 카피를 생성하고<br />
              Meta에 광고까지 자동으로 집행해드려요.
            </p>

            {errorMessage && (
              <div className="callout callout--danger" style={{ marginBottom: 16 }}>
                <Icon name="warn" size={16} />
                <div>
                  <div style={{ font: "700 13px/1.4 var(--w-font-sans)" }}>로그인할 수 없어요</div>
                  <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", marginTop: 2 }}>{errorMessage}</div>
                  <div style={{ font: "500 11.5px/1.5 var(--w-font-sans)", marginTop: 4, opacity: 0.6 }}>에러 코드: {errorCode}</div>
                </div>
              </div>
            )}

            {MAINTENANCE ? (
              <div className="callout callout--warn">
                <Icon name="warn" size={16} />
                <div>
                  <div style={{ font: "700 13px/1.4 var(--w-font-sans)" }}>현재 서비스 점검 중</div>
                  <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", marginTop: 2 }}>Meta 연동 관련 작업이 진행 중이에요. 완료 후 다시 로그인할 수 있어요.</div>
                </div>
              </div>
            ) : (
              <>
                <button className="btn btn--primary btn--lg btn--block" type="button" onClick={handleLogin} disabled={loading}>
                  {loading ? <Icon name="spinner" size={16} /> : <Icon name="facebook" size={16} />}
                  {loading ? "Facebook에 연결 중…" : "Facebook으로 로그인"}
                </button>
                <button className="btn btn--secondary btn--lg btn--block" type="button" onClick={handleBrowse} disabled={loading} style={{ marginTop: 10 }}>
                  로그인 없이 서비스 둘러보기
                </button>
                <p style={{ font: "500 12px/1.6 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "16px 0 0", textAlign: "center" }}>
                  광고 계정 관리 · 페이지 정보 · 광고 게재 권한을 사용해요.<br />
                  필요한 권한 외에는 요청하지 않아요.
                </p>
              </>
            )}

            <div style={{ display: "flex", gap: 14, marginTop: 32, font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
              <span>© 2026 AdFlow</span>
              <span>·</span>
              <Link href="/terms" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>이용약관</Link>
              <Link href="/privacy" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>개인정보처리방침</Link>
              <span>고객지원</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
