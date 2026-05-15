"use client";

// BriefForm — "디자이너 외주 스타일" 기획안·자료 입력.
// 기획안 부분은 STEP 01 state(헤드라인·본문·톤·outcome)에서 자동 채워 읽기 전용,
// 자료/사이즈/추가 지시는 brief 모드 안 로컬 state.

import Icon from "@shared/ui/Icon";
import { TONES, OBJECTIVES_ALL, type ToneId, type ObjectiveId } from "@entities/creative/options";

export const ASPECT_OPTIONS = [
  { id: "1:1" as const,  label: "1:1 정사각형",       enabled: true,  hint: "피드용 — 가장 안전" },
  { id: "4:5" as const,  label: "4:5 세로",           enabled: false, hint: "곧 지원" },
  { id: "9:16" as const, label: "9:16 스토리·릴스",   enabled: false, hint: "곧 지원" },
  { id: "16:9" as const, label: "16:9 가로",          enabled: false, hint: "곧 지원" },
];
export type AspectId = (typeof ASPECT_OPTIONS)[number]["id"];

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ font: "500 11px/1.4 var(--w-font-sans)", color: "var(--w-fg-normal)", flex: "0 0 72px" }}>{label}</span>
      <span style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-strong)", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
    </div>
  );
}

export default function BriefForm({
  state, scenes, logo, aspect, briefNotes, generating,
  onAddScenes, onRemoveScene, onClearScenes, onSetLogo, onRemoveLogo,
  onAspectChange, onNotesChange, onGenerate, onZoom,
}: {
  state: { headline: string; primaryText: string; tone: ToneId; outcomeChips: ObjectiveId[] };
  scenes: string[];
  logo: string | null;
  aspect: AspectId;
  briefNotes: string;
  generating: boolean;
  onAddScenes: (files: FileList | null) => void;
  onRemoveScene: (i: number) => void;
  onClearScenes: () => void;
  onSetLogo: (files: FileList | null) => void;
  onRemoveLogo: () => void;
  onAspectChange: (id: AspectId) => void;
  onNotesChange: (v: string) => void;
  onGenerate: () => void;
  onZoom: (src: string) => void;
}) {
  const toneLabel = TONES.find((t) => t.id === state.tone)?.label ?? state.tone;
  const outcomeDef = state.outcomeChips[0] ? OBJECTIVES_ALL.find((o) => o.id === state.outcomeChips[0]) : null;
  const hasCopy = !!state.headline?.trim();
  const hasMaterials = scenes.length > 0 || !!logo;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 1. 기획안 미리보기 — STEP 01 state 그대로 표시(읽기 전용) */}
      <div style={{ background: "var(--w-bg-alternative)", border: "1px solid var(--w-line-alternative)", borderRadius: 10, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Icon name="doc" size={13} style={{ color: "var(--w-fg-neutral)" }} />
          <span style={{ font: "600 12px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>1. 기획안 (STEP 01에서 자동)</span>
        </div>
        {hasCopy ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <BriefRow label="헤드라인" value={state.headline} />
            {state.primaryText && <BriefRow label="본문 카피" value={state.primaryText} />}
            <BriefRow label="톤" value={toneLabel} />
            {outcomeDef && <BriefRow label="광고 목표" value={`${outcomeDef.outcomeLabel} · ${outcomeDef.copyTone}`} />}
          </div>
        ) : (
          <p style={{ font: "500 12px/1.5 var(--w-font-sans)", color: "var(--w-status-cautionary)", margin: 0 }}>
            STEP 01에서 헤드라인을 먼저 만들어 주세요.
          </p>
        )}
      </div>

      {/* 2. 전달 자료 */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Icon name="upload" size={13} style={{ color: "var(--w-fg-neutral)" }} />
          <span style={{ font: "600 12px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>2. 전달 자료</span>
        </div>

        {/* 연출컷 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>연출컷 (분위기·앵글 참고)</span>
            <div style={{ display: "flex", gap: 6 }}>
              <label className="btn btn--ghost btn--sm" style={{ cursor: "pointer", borderColor: "var(--w-line-normal)" }}>
                <Icon name="upload" size={12} /> 연출컷 추가{scenes.length > 0 ? ` (${scenes.length})` : ""}
                <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => onAddScenes(e.target.files)} />
              </label>
              {scenes.length > 0 && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={onClearScenes} style={{ borderColor: "var(--w-line-normal)" }}>비우기</button>
              )}
            </div>
          </div>
          {scenes.length > 0 ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {scenes.map((src, i) => (
                <div key={i} style={{ position: "relative", width: 60, height: 60 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`연출컷 ${i + 1}`}
                    title="클릭하면 크게 볼 수 있어요"
                    onClick={() => onZoom(src)}
                    style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid var(--w-line-normal)", display: "block", cursor: "zoom-in" }}
                  />
                  <button
                    type="button"
                    aria-label={`연출컷 ${i + 1} 삭제`}
                    onClick={() => onRemoveScene(i)}
                    style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", border: "1px solid var(--w-line-normal)", background: "var(--w-bg-normal)", color: "var(--w-fg-neutral)", display: "grid", placeItems: "center", cursor: "pointer", padding: 0, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}
                  >
                    <Icon name="x" size={11} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="field__hint" style={{ margin: 0 }}>2~3장 권장 — 원하는 톤·앵글·라이팅에 가까운 사진</p>
          )}
        </div>

        {/* 로고 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>로고 파일 (선택)</span>
            <div style={{ display: "flex", gap: 6 }}>
              <label className="btn btn--ghost btn--sm" style={{ cursor: "pointer", borderColor: "var(--w-line-normal)" }}>
                <Icon name="upload" size={12} /> {logo ? "로고 변경" : "로고 첨부"}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onSetLogo(e.target.files)} />
              </label>
              {logo && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={onRemoveLogo} style={{ borderColor: "var(--w-line-normal)" }}>제거</button>
              )}
            </div>
          </div>
          {logo ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt="로고"
                title="클릭하면 크게 볼 수 있어요"
                onClick={() => onZoom(logo)}
                style={{ width: 60, height: 60, objectFit: "contain", borderRadius: 6, border: "1px solid var(--w-line-normal)", background: "#fff", cursor: "zoom-in" }}
              />
              <span className="field__hint" style={{ margin: 0 }}>투명 배경 PNG 권장. AI는 분위기만 참고하고 이미지에 직접 합성하진 않아요.</span>
            </div>
          ) : (
            <p className="field__hint" style={{ margin: 0 }}>없어도 돼요. 있으면 분위기 참고용으로 같이 보내요.</p>
          )}
        </div>

        {/* 추가 지시 */}
        <div>
          <span style={{ display: "block", font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-strong)", marginBottom: 6 }}>추가 지시사항 (선택)</span>
          <textarea
            className="textarea"
            value={briefNotes ?? ""}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="예) 인물 얼굴이 정면으로 보이게, 자연광 느낌, 텍스트 없이 제품 중심"
            style={{ minHeight: 64 }}
          />
        </div>
      </div>

      {/* 3. 작업 사이즈 */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Icon name="image" size={13} style={{ color: "var(--w-fg-neutral)" }} />
          <span style={{ font: "600 12px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>3. 작업 사이즈</span>
        </div>
        <div className="chips">
          {ASPECT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={"chip" + (aspect === opt.id ? " chip--on" : "")}
              disabled={!opt.enabled}
              style={{ opacity: opt.enabled ? 1 : 0.55 }}
              onClick={() => opt.enabled && onAspectChange(opt.id)}
              title={opt.hint}
            >
              {opt.label}
              {!opt.enabled && (
                <span style={{ marginLeft: 6, font: "600 10px/1 var(--w-font-mono)", padding: "2px 5px", borderRadius: 4, background: "var(--w-bg-alternative)", color: "var(--w-fg-neutral)" }}>곧 지원</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 생성 버튼 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 4, flexWrap: "wrap" }}>
        <span className="field__hint" style={{ margin: 0 }}>
          기획안 + 자료를 한 덩어리로 AI에 전달해 1:1 광고 이미지 3장을 만들어요.
        </span>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={generating || !hasCopy || !hasMaterials}
          title={!hasCopy ? "STEP 01에서 헤드라인을 먼저 만들어 주세요" : !hasMaterials ? "연출컷이나 로고를 1장 이상 올려주세요" : undefined}
          onClick={onGenerate}
        >
          {generating ? "생성 중…" : <><Icon name="sparkles" size={13} /> 이 기획안으로 3장 생성</>}
        </button>
      </div>
    </div>
  );
}
