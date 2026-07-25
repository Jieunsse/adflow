"use client";

// BriefForm — "디자이너 외주 스타일" 기획안·자료 입력.
// 기획안 부분은 STEP 01 state(헤드라인·본문·톤·outcome)에서 자동 채워 읽기 전용,
// 자료/사이즈/추가 지시는 brief 모드 안 로컬 state.

import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { cn } from "@shared/lib/cn";
import { OBJECTIVES_ALL, type ObjectiveId } from "@entities/creative/options";
import type { ReferenceMaterial } from "@shared/lib/referenceMaterials";

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
      <span style={{ font: "500 11px/1.4 var(--w-font-sans)", color: "var(--w-fg-neutral)", flex: "0 0 72px" }}>{label}</span>
      <span style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-strong)", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
    </div>
  );
}

function SectionHeader({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-[7px] mb-2.5">
      <span
        className="grid place-items-center w-[18px] h-[18px] rounded-full border-[1.5px] border-[var(--w-line-normal)] bg-[var(--w-bg-alternative)] font-bold text-[11px] leading-none text-[var(--w-fg-neutral)]"
        style={{ fontFamily: "var(--w-font-mono)" }}
      >
        {n}
      </span>
      <span className="font-semibold text-[11px] leading-none tracking-[0.04em] text-[var(--w-fg-neutral)]">{label}</span>
    </div>
  );
}

export default function BriefForm({
  state, scenes, logo, aspect, briefNotes, generating,
  warehouseMaterials, selectedMaterials,
  onAddScenes, onRemoveScene, onClearScenes, onSetLogo, onRemoveLogo,
  onAspectChange, onNotesChange, onGenerate, onZoom,
  onToggleMaterial, onUploadMaterial,
}: {
  state: { headline: string; primaryText: string; tone: string; outcome: ObjectiveId | null };
  scenes: string[];
  logo: string | null;
  aspect: AspectId;
  briefNotes: string;
  generating: boolean;
  warehouseMaterials: ReferenceMaterial[];
  selectedMaterials: ReferenceMaterial[];
  onAddScenes: (files: FileList | null) => void;
  onRemoveScene: (i: number) => void;
  onClearScenes: () => void;
  onSetLogo: (files: FileList | null) => void;
  onRemoveLogo: () => void;
  onAspectChange: (id: AspectId) => void;
  onNotesChange: (v: string) => void;
  onGenerate: () => void;
  onZoom: (src: string) => void;
  onToggleMaterial: (m: ReferenceMaterial) => void;
  onUploadMaterial: (files: FileList | null) => void;
}) {
  const toneLabel = state.tone;
  const outcomeDef = state.outcome ? OBJECTIVES_ALL.find((o) => o.id === state.outcome) : null;
  const hasCopy = !!state.headline?.trim();
  const hasMaterials = scenes.length > 0 || !!logo;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 1. 기획안 미리보기 — STEP 01 state 그대로 표시(읽기 전용) */}
      <div className="rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)] p-3.5">
        <SectionHeader n={1} label="기획안 (STEP 01에서 자동)" />
        {hasCopy ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <BriefRow label="헤드라인" value={state.headline} />
            {state.primaryText && <BriefRow label="본문 카피" value={state.primaryText} />}
            <BriefRow label="톤" value={toneLabel} />
            {outcomeDef && <BriefRow label="광고 목표" value={`${outcomeDef.outcomeLabel} · ${outcomeDef.copyTone}`} />}
          </div>
        ) : (
          <p className="flex items-center gap-1.5 font-medium text-[13px] leading-[1.5] text-[var(--w-status-cautionary)]" style={{ margin: 0 }}>
            <Icon name="warn" size={13} /> STEP 01에서 헤드라인을 먼저 만들어 주세요.
          </p>
        )}
      </div>

      {/* 2. 전달 자료 */}
      <div>
        <SectionHeader n={2} label="전달 자료" />

        {/* 연출컷 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>연출컷 (분위기·앵글 참고)</span>
            {scenes.length > 0 && (
              <div style={{ display: "flex", gap: 6 }}>
                <label className={cn("inline-flex items-center justify-center gap-1.5 border font-semibold leading-none tracking-[-0.002em] cursor-pointer transition-[background,border-color,color,box-shadow] duration-[120ms] whitespace-nowrap", "h-8 px-3 text-[13px] rounded-lg gap-[5px]", "bg-transparent border-[var(--w-line-normal)] text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)]")}>
                  <Icon name="upload" size={12} /> 연출컷 추가{` (${scenes.length})`}
                  <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => onAddScenes(e.target.files)} />
                </label>
                <Button variant="ghost" size="sm" onClick={onClearScenes} className="border-[var(--w-line-normal)]">비우기</Button>
              </div>
            )}
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
                    className="shadow-[var(--w-shadow-card)]"
                    style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", border: "1px solid var(--w-line-normal)", background: "var(--w-bg-normal)", color: "var(--w-fg-neutral)", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}
                  >
                    <Icon name="x" size={11} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--w-line-normal)] bg-[var(--w-bg-alternative)] py-5 px-4 cursor-pointer hover:bg-[var(--w-bg-neutral)] hover:border-[var(--w-primary-normal)] transition">
              <Icon name="upload" size={18} className="text-[var(--w-fg-alternative)]" />
              <span className="font-medium text-[13px] text-[var(--w-fg-normal)]">연출컷 추가</span>
              <span className="text-[12px] text-[var(--w-fg-neutral)]">2~3장 권장 — 원하는 톤·앵글·라이팅에 가까운 사진</span>
              <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => onAddScenes(e.target.files)} />
            </label>
          )}
        </div>

        {/* 로고 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>로고 파일 (선택)</span>
            {logo && (
              <div style={{ display: "flex", gap: 6 }}>
                <label className={cn("inline-flex items-center justify-center gap-1.5 border font-semibold leading-none tracking-[-0.002em] cursor-pointer transition-[background,border-color,color,box-shadow] duration-[120ms] whitespace-nowrap", "h-8 px-3 text-[13px] rounded-lg gap-[5px]", "bg-transparent border-[var(--w-line-normal)] text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)]")}>
                  <Icon name="upload" size={12} /> 로고 변경
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onSetLogo(e.target.files)} />
                </label>
                <Button variant="ghost" size="sm" onClick={onRemoveLogo} className="border-[var(--w-line-normal)]">제거</Button>
              </div>
            )}
          </div>
          {logo ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt="로고"
                title="클릭하면 크게 볼 수 있어요"
                onClick={() => onZoom(logo)}
                className="bg-[var(--w-bg-elevated)]"
                style={{ width: 60, height: 60, objectFit: "contain", borderRadius: 6, border: "1px solid var(--w-line-normal)", cursor: "zoom-in" }}
              />
              <span className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)]" style={{ margin: 0 }}>투명 배경 PNG 권장. AI는 분위기만 참고하고 이미지에 직접 합성하진 않아요.</span>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--w-line-normal)] bg-[var(--w-bg-alternative)] py-3.5 px-4 cursor-pointer hover:bg-[var(--w-bg-neutral)] hover:border-[var(--w-primary-normal)] transition">
              <Icon name="upload" size={18} className="text-[var(--w-fg-alternative)]" />
              <span className="font-medium text-[13px] text-[var(--w-fg-normal)]">로고 첨부 (선택)</span>
              <span className="text-[12px] text-[var(--w-fg-neutral)]">없어도 돼요. 있으면 분위기 참고용으로 같이 보내요.</span>
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onSetLogo(e.target.files)} />
            </label>
          )}
        </div>

        {/* 참고 자료 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>참고 자료 (선택)</span>
            <label className={cn("inline-flex items-center justify-center gap-1.5 border font-semibold leading-none tracking-[-0.002em] cursor-pointer transition-[background,border-color,color,box-shadow] duration-[120ms] whitespace-nowrap", "h-8 px-3 text-[13px] rounded-lg gap-[5px]", "bg-transparent border-[var(--w-line-normal)] text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)]")}>
              <Icon name="upload" size={12} /> 즉석 업로드
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" multiple style={{ display: "none" }} onChange={(e) => onUploadMaterial(e.target.files)} />
            </label>
          </div>
          {warehouseMaterials.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {warehouseMaterials.map((m) => {
                const selected = !!selectedMaterials.find((x) => x.id === m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onToggleMaterial(m)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                      borderRadius: 8, border: `1.5px solid ${selected ? "var(--w-primary-normal)" : "var(--w-line-normal)"}`,
                      background: selected ? "var(--w-primary-soft)" : "var(--w-bg-elevated)",
                      cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <span style={{ font: "600 11px/1 var(--w-font-mono)", padding: "2px 6px", borderRadius: 4, background: "var(--w-bg-alternative)", color: "var(--w-fg-neutral)", flexShrink: 0 }}>
                      {m.type.toUpperCase()}
                    </span>
                    <span style={{ font: "500 13px/1 var(--w-font-sans)", color: selected ? "var(--w-primary-press)" : "var(--w-fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.name}
                    </span>
                    {selected && <Icon name="check" size={12} style={{ color: "var(--w-primary-normal)", marginLeft: "auto", flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)]" style={{ margin: 0 }}>
              브랜드 프로필에 저장된 참고 자료가 없어요. 즉석 업로드하면 창고에도 자동 저장돼요.
            </p>
          )}
          {selectedMaterials.length > 0 && (
            <p className="font-medium text-[11px] leading-[1.5] tracking-[0.008em] text-[var(--w-primary-normal)]" style={{ margin: "4px 0 0" }}>
              {selectedMaterials.length}개 선택됨 — 이번 생성에 함께 전달돼요
            </p>
          )}
        </div>

        {/* 추가 지시 */}
        <div>
          <span style={{ display: "block", font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-strong)", marginBottom: 6 }}>추가 지시사항 (선택)</span>
          <textarea
            className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.6] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_var(--w-focus-ring)] resize-y min-h-[88px]"
            value={briefNotes ?? ""}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="예) 인물 얼굴이 정면으로 보이게, 자연광 느낌, 텍스트 없이 제품 중심"
            style={{ minHeight: 64 }}
          />
        </div>
      </div>

      {/* 3. 작업 사이즈 */}
      <div>
        <SectionHeader n={3} label="작업 사이즈" />
        <div className="flex gap-2 flex-wrap">
          {ASPECT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 px-[14px] py-2 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-none text-[var(--w-fg-strong)] cursor-pointer transition-[background,border-color,color] duration-[120ms] disabled:opacity-55",
                aspect === opt.id && "bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] border-[var(--w-primary-normal)]"
              )}
              disabled={!opt.enabled}
              onClick={() => opt.enabled && onAspectChange(opt.id)}
              title={opt.hint}
            >
              {aspect === opt.id && <Icon name="check" size={12} className="text-[var(--w-primary-normal)]" />}
              {opt.label}
              {!opt.enabled && (
                <span style={{ marginLeft: 6, font: "600 10px/1 var(--w-font-mono)", padding: "2px 5px", borderRadius: 4, background: "var(--w-bg-alternative)", color: "var(--w-fg-neutral)" }}>곧 지원</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 생성 버튼 */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap border-t border-[var(--w-line-alternative)] pt-3.5">
        {!hasCopy ? (
          <span className="flex items-center gap-1.5 font-medium text-[13px] leading-[1.5] text-[var(--w-status-cautionary)]" style={{ margin: 0 }}>
            <Icon name="warn" size={13} /> STEP 01에서 헤드라인을 먼저 만들어 주세요
          </span>
        ) : !hasMaterials ? (
          <span className="flex items-center gap-1.5 font-medium text-[13px] leading-[1.5] text-[var(--w-status-cautionary)]" style={{ margin: 0 }}>
            <Icon name="warn" size={13} /> 연출컷이나 로고를 1장 이상 올려주세요
          </span>
        ) : (
          <span className="font-medium text-[13px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)]" style={{ margin: 0 }}>
            기획안 + 자료를 한 덩어리로 AI에 전달해 1:1 광고 이미지 3장을 만들어요.
          </span>
        )}
        <Button
          variant="primary"
          size="sm"
          disabled={generating || !hasCopy || !hasMaterials}
          title={!hasCopy ? "STEP 01에서 헤드라인을 먼저 만들어 주세요" : !hasMaterials ? "연출컷이나 로고를 1장 이상 올려주세요" : undefined}
          onClick={onGenerate}
        >
          {generating ? "생성 중…" : <><Icon name="sparkles" size={13} /> 이 기획안으로 3장 생성</>}
        </Button>
      </div>
    </div>
  );
}
