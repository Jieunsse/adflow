import { ImageResponse } from "next/og";

export const alt = "AdFlow 로그인 화면";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const statStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
  width: 132,
  padding: "16px",
  borderRadius: 14,
  background: "rgba(255, 255, 255, 0.12)",
};

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#ffffff", fontFamily: "Arial, sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 620, padding: "48px 52px", color: "white", background: "linear-gradient(135deg, #001a4d 0%, #0066ff 45%, #6541f2 100%)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, fontWeight: 800 }}>
            <div style={{ display: "flex", width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, background: "rgba(255, 255, 255, 0.18)", fontSize: 24 }}>A</div>
            AdFlow
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.14em", opacity: 0.78 }}>TODAY'S CAMPAIGN</div>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 40, fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.04em" }}>
              <span>AI가 만든 카피로</span>
              <span>첫 주에 CTR</span>
              <span style={{ color: "#9cd4ff" }}>2.1% → 3.4%</span>
            </div>
            <div style={{ fontSize: 18, lineHeight: 1.5, opacity: 0.85 }}>제품 정보만 입력하면 헤드라인·타겟팅·예산 분배까지</div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={statStyle}><span style={{ fontSize: 23, fontWeight: 800 }}>2,847</span><span style={{ fontSize: 13, opacity: 0.78 }}>이번 주 집행</span></div>
              <div style={statStyle}><span style={{ fontSize: 23, fontWeight: 800 }}>+38%</span><span style={{ fontSize: 13, opacity: 0.78 }}>평균 CTR ↑</span></div>
              <div style={statStyle}><span style={{ fontSize: 23, fontWeight: 800 }}>12분</span><span style={{ fontSize: 13, opacity: 0.78 }}>집행까지</span></div>
            </div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, opacity: 0.85 }}>최지은 · 그로스 마케터</div>
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", padding: "72px" }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 410 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", color: "#0066ff" }}>MARKETING AI · 광고 자동화</div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 18, fontSize: 38, fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.04em", color: "#171717" }}>
              <span>마케터를 위한</span>
              <span>AI 광고 자동화</span>
            </div>
            <div style={{ marginTop: 16, fontSize: 17, lineHeight: 1.55, color: "#5a5c63" }}>제품 정보만 입력하면 AI가 카피를 생성하고 Meta에 광고까지 자동으로 집행해드려요.</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 56, marginTop: 34, borderRadius: 10, background: "#0066ff", color: "white", fontSize: 18, fontWeight: 700 }}>f&nbsp;&nbsp;Facebook으로 로그인</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 56, marginTop: 12, border: "1px solid #dcdcdc", borderRadius: 10, color: "#303030", fontSize: 18, fontWeight: 700 }}>로그인 없이 서비스 둘러보기</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
