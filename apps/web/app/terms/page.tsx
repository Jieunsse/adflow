import Link from "next/link";

export const metadata = {
  title: "이용약관 — AdFlow",
  description: "AdFlow 서비스 이용약관",
};

export default function TermsPage() {
  return (
    <div className="adflow" style={{ minHeight: "100vh", background: "var(--w-bg-alternative)" }}>
      <article style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px 96px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--w-primary-normal)", display: "grid", placeItems: "center", color: "#fff", font: "800 14px/1 var(--w-font-display)", letterSpacing: "-0.03em" }}>A</div>
          <span style={{ font: "800 17px/1 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.022em" }}>AdFlow</span>
        </div>

        <h1 style={H1}>이용약관</h1>
        <p style={Lead}>Terms of Service</p>
        <p style={Meta}>시행일: 2026년 5월 18일 · 최종 수정일: 2026년 5월 18일</p>

        <div style={{ background: "var(--w-bg-elevated)", border: "1px solid var(--w-line-soft)", borderRadius: 12, padding: "20px 22px", margin: "0 0 32px" }}>
          <p style={{ ...Body, margin: 0 }}>
            본 약관은 현재 준비 중입니다. 정식 공개 전까지는 아래 항목이 임시 안내로 적용됩니다.
            상세 조항이 확정되면 본 페이지를 통해 다시 공지합니다.
          </p>
        </div>

        <h2 style={H2}>1. 목적</h2>
        <p style={Body}>
          본 약관은 AdFlow(이하 &quot;서비스&quot;)가 제공하는 광고 자동화 기능의 이용 조건과 절차, 이용자와 서비스의 권리·의무·책임 사항을 규정합니다.
        </p>

        <h2 style={H2}>2. 서비스의 제공</h2>
        <p style={Body}>
          서비스는 Meta 광고 계정 연동을 통해 광고 소재 생성·집행·성과 분석 기능을 제공합니다. 세부 기능 범위는 화면 및 도움말을 통해 안내됩니다.
        </p>

        <h2 style={H2}>3. 이용자의 의무</h2>
        <p style={Body}>
          이용자는 관련 법령, 본 약관 및 서비스가 안내하는 운영 정책을 준수하여야 하며, 타인의 권리를 침해하거나 서비스 운영을 방해하는 행위를 해서는 안 됩니다.
        </p>

        <h2 style={H2}>4. 개인정보의 처리</h2>
        <p style={Body}>
          서비스는 이용자의 개인정보를 별도의 <Link href="/privacy" style={Link_}>개인정보처리방침</Link>에 따라 보호하며, 본 약관과 함께 적용됩니다.
        </p>

        <h2 style={H2}>5. 약관의 변경</h2>
        <p style={Body}>
          본 약관은 관련 법령 및 서비스 정책에 따라 변경될 수 있으며, 변경 시 사전에 본 페이지를 통해 공지합니다.
        </p>

        <h2 style={H2}>6. 문의</h2>
        <p style={Body}>
          서비스 이용 관련 문의는 운영자(test@example.com)로 연락해 주세요.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 56, paddingTop: 24, borderTop: "1px solid var(--w-line-soft)", font: "500 13px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
          <Link href="/privacy" style={Link_}>개인정보처리방침 보기</Link>
          <span>·</span>
          <Link href="/login" style={Link_}>로그인으로 돌아가기</Link>
        </div>
      </article>
    </div>
  );
}

const H1: React.CSSProperties = { font: "800 32px/1.25 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.024em", margin: "0 0 6px" };
const Lead: React.CSSProperties = { font: "500 14px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "0 0 12px" };
const Meta: React.CSSProperties = { font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "0 0 32px" };
const H2: React.CSSProperties = { font: "700 17px/1.4 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.018em", margin: "32px 0 12px" };
const Body: React.CSSProperties = { font: "500 14.5px/1.75 var(--w-font-sans)", color: "var(--w-fg-strong)", margin: "0 0 12px" };
const Link_: React.CSSProperties = { color: "var(--w-primary-normal)", textDecoration: "underline", textUnderlineOffset: 3 };
