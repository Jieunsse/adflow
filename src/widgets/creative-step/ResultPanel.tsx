"use client";

// STEP 01 AI 생성 결과 카드 — 스켈레톤 / 빈 상태 / 헤드라인 피커·본문·CTA·이미지 생성.

import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import AiImageBlock from "./AiImageBlock";

interface Props {
  generating: boolean;
  generated: boolean;
  headlines: string[] | null;
  headlineIdx: number;
  onSelectHeadline: (i: number) => void;
  primaryText: string;
  setPrimaryText: (v: string) => void;
  elapsed: number;
  onSaveToLibrary: () => void;
  saved: boolean;
  goLibrary: () => void;
  onNext: () => void;
  imageDataUrl: string | null;
  setImageDataUrl: (v: string | null) => void;
}

export default function ResultPanel(p: Props) {
  return (
    <div className="card card--lg" style={{ position: "sticky", top: 20 }}>
      <div className="between">
        <div>
          <h2 className="section-title">AI 생성 결과</h2>
          <p className="section-sub">헤드라인을 고르고, 본문을 다듬어 보세요.</p>
        </div>
        <Badge kind="violet"><Icon name="sparkles" size={12} /> AI 생성</Badge>
      </div>
      <hr className="divider" />

      {p.generating ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="skel" style={{ height: 16, width: "40%" }} />
          <div className="skel" style={{ height: 56 }} />
          <div className="skel" style={{ height: 56 }} />
          <div className="skel" style={{ height: 56 }} />
          <div className="skel" style={{ height: 16, width: "30%", marginTop: 8 }} />
          <div className="skel" style={{ height: 110 }} />
        </div>
      ) : !p.generated || !p.headlines ? (
        <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--w-fg-normal)" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--w-accent-violet-soft)", color: "var(--w-accent-violet)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
            <Icon name="sparkles" size={22} />
          </div>
          <div style={{ font: "600 15px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>좌측 정보를 입력하고 생성 버튼을 눌러주세요</div>
          <p style={{ margin: "8px auto 0", maxWidth: 320, font: "500 13px/1.55 var(--w-font-sans)" }}>3–5초 내에 헤드라인 3개와 본문·타겟팅 제안을 받아볼 수 있어요.</p>
        </div>
      ) : (
        <>
          <div className="field" style={{ marginBottom: 18 }}>
            <label className="field__label">헤드라인 — 1개 선택</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {p.headlines.map((h, i) => (
                <div
                  key={i}
                  className={"radio-card" + (p.headlineIdx === i ? " radio-card--on" : "")}
                  onClick={() => p.onSelectHeadline(i)}
                  role="radio"
                  aria-checked={p.headlineIdx === i}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      p.onSelectHeadline(i);
                    }
                  }}
                >
                  <div className="radio-card__indicator" />
                  <div style={{ flex: 1 }}>
                    <div className="radio-card__num">VER 0{i + 1}</div>
                    <div className="radio-card__text">{h}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label className="field__label">기본 텍스트</label>
              <span style={{ font: "500 11.5px/1 var(--w-font-mono)", color: "var(--w-fg-neutral)" }}>{p.primaryText.length} / 200자</span>
            </div>
            <textarea className="textarea" value={p.primaryText} onChange={(e) => p.setPrimaryText(e.target.value)} style={{ minHeight: 120 }} />
          </div>


          <AiImageBlock imageDataUrl={p.imageDataUrl} setImageDataUrl={p.setImageDataUrl} />

          <div className="between" style={{ paddingTop: 16, borderTop: "1px solid var(--w-line-alternative)", flexWrap: "wrap", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-normal)" }}>
              <Icon name="check" size={14} style={{ color: "var(--w-status-positive)" }} />
              생성 완료 · {p.elapsed.toFixed(1)}s
            </span>
            <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              {p.saved ? (
                <button className="btn btn--secondary" type="button" onClick={p.goLibrary} title="소재 라이브러리에서 보기">
                  <Icon name="check" size={14} style={{ color: "var(--w-status-positive)" }} />
                  라이브러리에 저장됨
                </button>
              ) : (
                <button className="btn btn--secondary" type="button" onClick={p.onSaveToLibrary}>
                  <Icon name="folder" size={14} /> 소재 라이브러리에 저장
                </button>
              )}
              <button className="btn btn--primary" type="button" onClick={p.onNext}>다음: 광고 집행 <Icon name="arrow-right" size={14} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
