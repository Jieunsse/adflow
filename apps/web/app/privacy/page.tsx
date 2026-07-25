import Link from "next/link";

export const metadata = {
  title: "개인정보처리방침 — AdFlow",
  description: "AdFlow 서비스의 개인정보 수집·이용·보관 정책 안내",
};

export default function PrivacyPage() {
  return (
    <div className="adflow" style={{ minHeight: "100vh", background: "var(--w-bg-alternative)" }}>
      <article style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px 96px" }}>
        <PolicyHeader />

        <h1 style={H1}>개인정보처리방침</h1>
        <p style={Lead}>Privacy Policy</p>
        <p style={Meta}>시행일: 2026년 5월 18일 · 최종 수정일: 2026년 5월 18일</p>

        <p style={Body}>
          본 애플리케이션(이하 &quot;서비스&quot;)은 이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 등 관련 법령을 준수합니다.
          본 방침은 서비스가 어떤 정보를 수집하고 어떻게 이용하는지를 안내합니다.
        </p>

        <h2 style={H2}>1. 수집하는 개인정보 항목</h2>
        <p style={Body}>서비스는 다음의 정보를 수집할 수 있습니다.</p>
        <ul style={List}>
          <li><strong>계정 정보</strong>: 이름, 이메일 주소, 프로필 이미지</li>
          <li><strong>인증 정보</strong>: 소셜 로그인을 통해 제공되는 식별자(ID)</li>
          <li><strong>이용 기록</strong>: 접속 일시, 서비스 이용 내역</li>
        </ul>

        <h2 style={H2}>2. 개인정보의 수집 및 이용 목적</h2>
        <ul style={List}>
          <li>회원 식별 및 로그인 기능 제공</li>
          <li>서비스 운영 및 이용자 문의 대응</li>
          <li>서비스 개선 및 기능 개발</li>
        </ul>

        <h2 style={H2}>3. 개인정보의 보유 및 이용 기간</h2>
        <p style={Body}>
          수집된 개인정보는 수집 및 이용 목적이 달성되면 지체 없이 파기합니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.
        </p>

        <h2 style={H2}>4. 개인정보의 제3자 제공</h2>
        <p style={Body}>
          서비스는 이용자의 개인정보를 외부에 제공하지 않습니다. 다만 법령에 근거하거나 이용자의 동의가 있는 경우는 예외로 합니다.
        </p>

        <h2 style={H2}>5. 개인정보의 파기</h2>
        <p style={Body}>
          보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 복구가 불가능한 방법으로 안전하게 파기합니다.
        </p>

        <h2 style={H2}>6. 이용자의 권리</h2>
        <p style={Body}>
          이용자는 언제든지 본인의 개인정보에 대한 열람, 정정, 삭제 및 처리 정지를 요청할 수 있으며, 서비스는 이에 대해 지체 없이 조치합니다.
        </p>

        <h2 style={H2}>7. 개인정보 보호책임자</h2>
        <ul style={List}>
          <li>담당자: Jayden Ock</li>
          <li>이메일: jayden@jocodingax.ai</li>
        </ul>

        <h2 style={H2}>8. 개인정보처리방침의 변경</h2>
        <p style={Body}>
          본 방침은 법령 및 서비스 정책에 따라 변경될 수 있으며, 변경 시 본 페이지를 통해 공지합니다.
        </p>

        <PolicyFooter current="privacy" />
      </article>
    </div>
  );
}

function PolicyHeader() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--w-primary-normal)", display: "grid", placeItems: "center", color: "#fff", font: "800 14px/1 var(--w-font-display)", letterSpacing: "-0.03em" }}>A</div>
      <span style={{ font: "800 17px/1 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.022em" }}>AdFlow</span>
    </div>
  );
}

function PolicyFooter({ current }: { current: "privacy" | "terms" }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 56, paddingTop: 24, borderTop: "1px solid var(--w-line-soft)", font: "500 13px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
      {current === "privacy" ? (
        <Link href="/terms" style={Link_}>이용약관 보기</Link>
      ) : (
        <Link href="/privacy" style={Link_}>개인정보처리방침 보기</Link>
      )}
      <span>·</span>
      <Link href="/login" style={Link_}>로그인으로 돌아가기</Link>
    </div>
  );
}

const H1: React.CSSProperties = { font: "800 32px/1.25 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.024em", margin: "0 0 6px" };
const Lead: React.CSSProperties = { font: "500 14px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "0 0 12px" };
const Meta: React.CSSProperties = { font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "0 0 32px" };
const H2: React.CSSProperties = { font: "700 17px/1.4 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.018em", margin: "32px 0 12px" };
const Body: React.CSSProperties = { font: "500 14.5px/1.75 var(--w-font-sans)", color: "var(--w-fg-strong)", margin: "0 0 12px" };
const List: React.CSSProperties = { font: "500 14.5px/1.85 var(--w-font-sans)", color: "var(--w-fg-strong)", margin: "0 0 12px", paddingLeft: 22 };
const Link_: React.CSSProperties = { color: "var(--w-primary-normal)", textDecoration: "underline", textUnderlineOffset: 3 };
