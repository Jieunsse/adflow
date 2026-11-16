"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";

const MAINTENANCE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Meta 앱 연결 중 오류가 발생했어요. Meta 개발자 계정이 일시 정지됐을 수 있어요.",
  OAuthCallback: "Meta 앱 연결 중 오류가 발생했어요. Meta 개발자 계정이 일시 정지됐을 수 있어요.",
  OAuthAccountNotLinked: "이미 다른 방식으로 가입된 계정이에요.",
  AccessDenied: "앱 접근이 거부됐어요. 테스터로 등록된 계정인지 확인해주세요.",
  NotClient: "고객으로 등록되지 않은 이메일이에요. 담당자에게 이 이메일을 등록해 달라고 요청해 주세요.",
  EmailNotVerified: "이메일이 확인되지 않은 계정이에요. 이메일 인증을 마친 계정으로 로그인해 주세요.",
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
  const router = useRouter();
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default) : null;
  const [loading, setLoading] = useState(false);
  const { status: sessionStatus } = useSession();
  const [facebookAvailable, setFacebookAvailable] = useState<boolean | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [clientEmail, setClientEmail] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [social, setSocial] = useState<{ google: boolean; kakao: boolean }>({ google: false, kakao: false });

  async function handleClientLogin() {
    setLoading(true);
    setClientError(null);
    const r = await signIn("client-email", { email: clientEmail, password: clientPassword, redirect: false });
    if (r?.ok && !r.error) {
      router.replace("/portal");
      return;
    }
    setLoading(false);
    setClientError(r?.error && r.error !== "CredentialsSignin" ? r.error : "이메일이나 비밀번호가 맞지 않아요. 다시 확인해 주세요.");
  }

  useEffect(() => {
    const prev = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "light");
    return () => {
      if (prev) document.documentElement.setAttribute("data-theme", prev);
    };
  }, []);

  useEffect(() => {
    fetch("/api/auth/providers", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : {})
      .then((providers: Record<string, unknown>) => {
        setFacebookAvailable(!!providers.facebook);
        // 카카오·구글은 키를 넣었을 때만 켜진다. 켜진 것만 버튼을 보여 준다.
        setSocial({ google: !!providers.google, kakao: !!providers.kakao });
      })
      .catch(() => setFacebookAvailable(false));
  }, []);

  async function handleLogin() {
    if (facebookAvailable !== true) return;
    setLoading(true);
    setLoginError(null);
    try {
      const result = await signIn("facebook", { callbackUrl: "/dashboard", redirect: false });
      if (result?.error) setLoginError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.Default);
      else if (result?.url) window.location.assign(result.url);
      else setLoginError(ERROR_MESSAGES.Default);
    } catch {
      setLoginError(ERROR_MESSAGES.Default);
    } finally {
      setLoading(false);
    }
  }

  async function handleBrowse() {
    setLoading(true);
    setLoginError(null);
    try {
      await signIn("guest", { callbackUrl: "/dashboard" });
    } catch {
      setLoginError(ERROR_MESSAGES.Default);
    } finally {
      setLoading(false);
    }
  }

  const visibleError = loginError ?? errorMessage;

  return (
    <div
      className="adflow [font-family:var(--w-font-sans)] [color:var(--w-fg-normal)] [background:var(--w-bg-alternative)] text-[14px] min-h-screen [color-scheme:light] [-webkit-font-smoothing:antialiased] [text-rendering:optimizeLegibility]"
      style={{ colorScheme: "light" }}
    >
      <div
        className="min-h-screen grid [grid-template-columns:1.05fr_1fr] [background:var(--w-bg-elevated)]"
        data-screen-label="로그인"
      >
        <aside
          className="[background:linear-gradient(135deg,#001a4d_0%,#0066ff_45%,#6541f2_100%)] px-16 py-14 text-white flex flex-col justify-between relative overflow-hidden"
          style={{
            // ::after pseudo handled inline is not possible; retaining as bg overlay effect via CSS workaround
          }}
        >
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

        <section className="px-20 py-16 flex flex-col justify-center gap-7">
          <div style={{ maxWidth: 380, width: "100%" }}>
            <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-primary-normal)]" style={{ letterSpacing: "0.12em", fontSize: 11 }}>Marketing AI · 광고 자동화</span>
            <h1 style={{ font: "800 32px/1.25 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.024em", margin: "12px 0 10px" }}>
              마케터를 위한<br />AI 광고 자동화
            </h1>
            <p style={{ font: "500 14px/1.6 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "0 0 28px" }}>
              제품 정보만 입력하면 AI가 카피를 생성하고<br />
              Meta에 광고까지 자동으로 집행해드려요.
            </p>

            {visibleError && (
              <div className="flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] border border-transparent bg-[rgba(255,66,66,0.08)] border-[rgba(255,66,66,0.20)] text-[var(--w-status-negative)]" style={{ marginBottom: 16 }}>
                <Icon name="warn" size={16} />
                <div>
                  <div style={{ font: "700 13px/1.4 var(--w-font-sans)" }}>로그인할 수 없어요</div>
                  <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", marginTop: 2 }}>{visibleError}</div>
                  {errorCode && <div style={{ font: "500 11.5px/1.5 var(--w-font-sans)", marginTop: 4, opacity: 0.6 }}>에러 코드: {errorCode}</div>}
                </div>
              </div>
            )}

            {MAINTENANCE ? (
              <div className="flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] border border-transparent bg-[rgba(255,146,0,0.10)] border-[rgba(255,146,0,0.24)] text-[var(--w-status-cautionary)]">
                <Icon name="warn" size={16} />
                <div>
                  <div style={{ font: "700 13px/1.4 var(--w-font-sans)" }}>현재 서비스 점검 중</div>
                  <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", marginTop: 2 }}>Meta 연동 관련 작업이 진행 중이에요. 완료 후 다시 로그인할 수 있어요.</div>
                </div>
              </div>
            ) : (
              <>
                {facebookAvailable === false ? (
                  <div className="flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] border border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)]">
                    <Icon name="info" size={16} />
                    <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)" }}>현재 Facebook 로그인을 사용할 수 없어요. 관리자에게 Meta 앱 설정을 확인해주세요.</div>
                  </div>
                ) : (
                  <Button variant="primary" size="lg" block type="button" onClick={handleLogin} disabled={loading || facebookAvailable !== true}>
                    {loading ? <Icon name="spinner" size={16} /> : <Icon name="facebook" size={16} />}
                    {facebookAvailable === null ? "Facebook 로그인 확인 중…" : loading ? "Facebook에 연결 중…" : "Facebook으로 로그인"}
                  </Button>
                )}
                <Button variant="secondary" size="lg" block type="button" onClick={handleBrowse} disabled={loading || sessionStatus === "loading"} style={{ marginTop: 10 }}>
                  로그인 없이 서비스 둘러보기
                </Button>
                <p style={{ font: "500 12px/1.6 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "16px 0 0", textAlign: "center" }}>
                  광고 계정 관리 · 페이지 정보 · 광고 게재 권한을 사용해요.<br />
                  필요한 권한 외에는 요청하지 않아요.
                </p>

                {/* 고객 로그인 (정책서 3.1) — 대행 고객사 담당자. 직원은 위 Facebook 로그인을 쓴다. */}
                <div className="mt-8 pt-6 border-t border-[var(--w-line-normal)] flex flex-col gap-3">
                  <h2 className="m-0 font-bold text-[15px] text-[var(--w-fg-strong)]">고객사 담당자이신가요?</h2>
                  {clientError && (
                    <div role="alert" className="rounded-lg px-3.5 py-3 font-medium text-[13px] bg-[var(--w-status-negative-soft)] text-[var(--w-status-negative)]">{clientError}</div>
                  )}
                  <label htmlFor="client-email" className="sr-only">이메일</label>
                  <input id="client-email" type="email" autoComplete="email" placeholder="이메일" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="w-full rounded-lg border border-[var(--w-line-normal)] p-3 text-[14px] font-medium" />
                  <label htmlFor="client-password" className="sr-only">비밀번호</label>
                  <input id="client-password" type="password" autoComplete="current-password" placeholder="비밀번호" value={clientPassword} onChange={(e) => setClientPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void handleClientLogin(); }} className="w-full rounded-lg border border-[var(--w-line-normal)] p-3 text-[14px] font-medium" />
                  <Button variant="primary" size="lg" block type="button" onClick={handleClientLogin} disabled={loading || !clientEmail || !clientPassword}>
                    이메일로 로그인
                  </Button>
                  {social.kakao && (
                    <Button variant="secondary" size="lg" block type="button" disabled={loading} onClick={() => signIn("kakao", { callbackUrl: "/portal" })}>카카오로 계속하기</Button>
                  )}
                  {social.google && (
                    <Button variant="secondary" size="lg" block type="button" disabled={loading} onClick={() => signIn("google", { callbackUrl: "/portal" })}>구글로 계속하기</Button>
                  )}
                  <div className="flex justify-between font-medium text-[13px] text-[var(--w-fg-neutral)]">
                    <Link href="/signup" className="underline">회원가입하기</Link>
                    <Link href="/reset-password" className="underline">비밀번호를 잊었어요</Link>
                  </div>
                </div>
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
