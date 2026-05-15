"use client";

import Icon from "@shared/ui/Icon";

interface Props {
  scenario: "good" | "poor";
  setScenario: (s: "good" | "poor") => void;
}

export default function ExampleBanner({ scenario, setScenario }: Props) {
  return (
    <div className="card" style={{ background: "var(--w-accent-violet-soft)", borderColor: "transparent", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ color: "var(--w-accent-violet)", paddingTop: 2 }}><Icon name="info" size={18} /></div>
        <div>
          <div style={{ font: "600 14px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>아직 집행한 광고가 없어 예시 데이터를 보여드려요</div>
          <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 3 }}>실제로 광고를 집행하면 같은 화면에서 진짜 성과를 볼 수 있어요. (적용 버튼은 집행 후 활성화돼요)</div>
        </div>
      </div>
      <div className="seg">
        <button type="button" className={scenario === "good" ? "on" : ""} onClick={() => setScenario("good")}>양호 예시</button>
        <button type="button" className={scenario === "poor" ? "on" : ""} onClick={() => setScenario("poor")}>개선 필요 예시</button>
      </div>
    </div>
  );
}
