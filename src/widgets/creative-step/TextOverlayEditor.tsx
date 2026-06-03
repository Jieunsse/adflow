"use client";

// 텍스트 편집(Text Overlay) — ADR-040 §6 후속. AI 모델이 못 그리는 한글을 클라이언트에서 직접 얹는다.
// 좌 = 컨트롤 패널(블록 자유 추가) / 우 = IgPostPreview 기반 실시간 합성 캔버스(드래그).
// 저장 = canvas 1024² 재드로잉 → PNG 스냅샷. 레이어 비영속(재오픈 = 깨끗한 베이스, CONTEXT Text Overlay V1 A 스코프·영속 후속 B).

import { useEffect, useRef, useState } from "react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Select } from "@shared/ui/Select";
import { useToast } from "@shared/ui/Toast";
import { IgPostPreview } from "@shared/ui/IgPostPreview";

const CANVAS_PX = 1024;
const FONT_FAMILY = "Pretendard";
const LINE_HEIGHT = 1.25;

// 외곽선 계수 — 미리보기(textShadow)와 canvas(shadowBlur/2-pass fillText)가 공유.
// 하드 외곽선(stroke) 폐기 → 2겹 받침: 겹1 글자색 대비 헤일로(얇게) + 겹2 dark soft 그림자.
const HALO_BLUR_RATIO = 0.015;
const SOFT_BLUR_RATIO = 0.18;
const SOFT_OFFSET_RATIO = 0.012;
const HALO_LIGHT = "rgba(255,255,255,0.9)";
const HALO_DARK = "rgba(0,0,0,0.9)";
const SOFT_SHADOW = "rgba(0,0,0,0.35)";

// 크기 세그먼트 — fontPct 매핑. ±스텝으로 단계를 벗어나면 무선택.
const SIZE_STEPS = [
  { label: "S", fontPct: 5 },
  { label: "M", fontPct: 6.5 },
  { label: "L", fontPct: 9 },
  { label: "XL", fontPct: 11 },
] as const;
const SIZE_MIN = 2;
const SIZE_MAX = 30;
const SIZE_STEP = 0.5;

type Align = "left" | "center" | "right";
type Preset = "title" | "subtitle" | "hook";
type TemplateId = "A" | "B" | "C" | "D";
type Band = "top" | "bottom" | null;

export type Block = {
  id: string;
  text: string;
  xPct: number; // 박스 중심 x (0~100)
  yPct: number; // 박스 중심 y (0~100)
  fontPct: number; // 캔버스 폭 대비 글자 크기 %
  color: string;
  align: Align;
  weight: 400 | 700;
  outline: boolean; // 외곽선 (2겹 soft 받침, 사진 위 가독성)
};

const PRESETS: Record<Preset, { label: string; base: Omit<Block, "id"> }> = {
  title: {
    label: "타이틀",
    base: { text: "타이틀을 입력하세요", xPct: 50, yPct: 18, fontPct: 9, color: "#ffffff", align: "center", weight: 700, outline: true },
  },
  subtitle: {
    label: "부제",
    base: { text: "부제를 입력하세요", xPct: 50, yPct: 31, fontPct: 5, color: "#ffffff", align: "center", weight: 400, outline: true },
  },
  hook: {
    label: "후킹 문구",
    base: { text: "지금 확인하세요", xPct: 50, yPct: 84, fontPct: 6.5, color: "#ffffff", align: "center", weight: 700, outline: true },
  },
};

const TITLE_BASE = (over: Partial<Omit<Block, "id">>): Omit<Block, "id"> => ({
  text: "", xPct: 50, yPct: 50, fontPct: 9, color: "#ffffff", align: "center", weight: 700, outline: true, ...over,
});

// 시작 템플릿 4종 — 주표제/보조 블록을 결정적으로 배치. band 는 Block 모델 밖 템플릿 속성.
const TEMPLATES: Record<TemplateId, { label: string; band: Band; blocks: Omit<Block, "id">[] }> = {
  A: {
    label: "하단 밴드", band: "bottom",
    blocks: [TITLE_BASE({ yPct: 78, fontPct: 9.5 }), TITLE_BASE({ yPct: 89, fontPct: 4.5, weight: 400 })],
  },
  B: {
    label: "상단 중앙", band: "top",
    blocks: [TITLE_BASE({ yPct: 16, fontPct: 9 }), TITLE_BASE({ yPct: 28, fontPct: 5, weight: 400 })],
  },
  C: {
    label: "중앙 강조", band: null,
    blocks: [TITLE_BASE({ yPct: 50, fontPct: 11 })],
  },
  D: { label: "빈 시작", band: null, blocks: [] },
};

// 템플릿 → Block[]. 주표제(첫 블록)에 headlineSuggestion 자동 주입(없으면 placeholder).
function pickTemplate(t: TemplateId, headline?: string): Block[] {
  const tpl = TEMPLATES[t];
  return tpl.blocks.map((base, i) => ({
    id: `t${t}-${i}`,
    ...base,
    text: i === 0 ? (headline?.trim() || "여기에 표제를 입력하세요") : "부가 문구",
  }));
}

const SWATCHES = ["#ffffff", "#000000", "#ffe14d", "#ff5a5f", "#0066ff"];

// hex 색의 밝기 → 받침 헤일로 대비색 결정.
function isLightColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

// 미리보기·canvas 공유 받침. 글자색이 밝으면 흰 헤일로(어두운 배경 가정), 어두우면 검정 헤일로.
function haloColor(color: string): string {
  return isLightColor(color) ? HALO_LIGHT : HALO_DARK;
}

const BAND_DARK = 0.55;
const BAND_HEIGHT_PCT = 35;

// 템플릿 픽토그램 — 단색 토큰 도형(32×32). A 하단·B 상단·C 중앙·D 빈(점선).
function TemplatePicto({ id }: { id: TemplateId }) {
  const fill = "var(--w-fg-neutral)";
  return (
    <svg width={32} height={32} viewBox="0 0 32 32" aria-hidden="true">
      <rect x={3} y={3} width={26} height={26} rx={3} fill="none" stroke="var(--w-line-normal)" strokeWidth={1.5} strokeDasharray={id === "D" ? "3 3" : undefined} />
      {id === "A" && (<><rect x={8} y={20} width={16} height={3} rx={1.5} fill={fill} /><rect x={11} y={25} width={10} height={1.5} rx={0.75} fill={fill} /></>)}
      {id === "B" && (<><rect x={8} y={7} width={16} height={3} rx={1.5} fill={fill} /><rect x={11} y={12} width={10} height={1.5} rx={0.75} fill={fill} /></>)}
      {id === "C" && <rect x={6} y={15} width={20} height={3.5} rx={1.75} fill={fill} />}
    </svg>
  );
}

// 캔버스로 베이스 이미지 + 밴드 + 텍스트 블록을 1024² PNG 로 굽는다.
async function compose(baseUrl: string, blocks: Block[], band: Band = null): Promise<string> {
  await Promise.all([
    document.fonts.load(`400 80px ${FONT_FAMILY}`),
    document.fonts.load(`700 80px ${FONT_FAMILY}`),
  ]).catch(() => {});

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = baseUrl;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context 를 얻지 못했어요");

  // cover 로 정사각 채우기 (베이스는 1:1 전제 — Generate Image 1:1 only).
  const scale = Math.max(CANVAS_PX / img.width, CANVAS_PX / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, (CANVAS_PX - dw) / 2, (CANVAS_PX - dh) / 2, dw, dh);

  if (band) {
    const bandH = (BAND_HEIGHT_PCT / 100) * CANVAS_PX;
    const grad = band === "bottom"
      ? ctx.createLinearGradient(0, CANVAS_PX - bandH, 0, CANVAS_PX)
      : ctx.createLinearGradient(0, bandH, 0, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${BAND_DARK})`);
    ctx.fillStyle = grad;
    const y0 = band === "bottom" ? CANVAS_PX - bandH : 0;
    ctx.fillRect(0, y0, CANVAS_PX, bandH);
  }

  for (const b of blocks) {
    const text = b.text.trim();
    if (!text) continue;
    const fontPx = (b.fontPct / 100) * CANVAS_PX;
    const lineH = fontPx * LINE_HEIGHT;
    const lines = text.split("\n");
    ctx.font = `${b.weight} ${fontPx}px ${FONT_FAMILY}`;
    ctx.textBaseline = "middle";

    const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const cx = (b.xPct / 100) * CANVAS_PX;
    const cy = (b.yPct / 100) * CANVAS_PX;
    const leftEdge = cx - maxW / 2;
    const top = cy - (lines.length * lineH) / 2;

    lines.forEach((line, i) => {
      const y = top + i * lineH + lineH / 2;
      let x = cx;
      if (b.align === "left") { ctx.textAlign = "left"; x = leftEdge; }
      else if (b.align === "right") { ctx.textAlign = "right"; x = leftEdge + maxW; }
      else { ctx.textAlign = "center"; x = cx; }

      ctx.fillStyle = b.color;
      if (b.outline) {
        // 겹2 dark soft — 1차 pass.
        ctx.shadowColor = SOFT_SHADOW;
        ctx.shadowBlur = fontPx * SOFT_BLUR_RATIO;
        ctx.shadowOffsetY = fontPx * SOFT_OFFSET_RATIO;
        ctx.fillText(line, x, y);
        // 겹1 헤일로 — 2차 pass(최종 fill 색 동일, 받침만 교체).
        ctx.shadowColor = haloColor(b.color);
        ctx.shadowBlur = fontPx * HALO_BLUR_RATIO;
        ctx.shadowOffsetY = 0;
        ctx.fillText(line, x, y);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      } else {
        ctx.shadowBlur = 0;
        ctx.fillText(line, x, y);
      }
    });
  }

  return canvas.toDataURL("image/png");
}

export default function TextOverlayEditor({
  baseImageUrl,
  headlineSuggestion,
  overlayHeadlines,
  onClose,
  onSave,
}: {
  baseImageUrl: string;
  headlineSuggestion?: string;
  overlayHeadlines?: string[];
  onClose: () => void;
  onSave: (finalDataUrl: string | null) => void;
}) {
  const showToast = useToast();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [band, setBand] = useState<Band>(null);
  const [saving, setSaving] = useState(false);
  const idRef = useRef(1);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const requestClose = () => {
    const hasFilled = blocks.some((b) => b.text.trim());
    if (hasFilled && !window.confirm("닫으면 텍스트가 사라져요. 저장하면 이미지로 합쳐집니다.")) return;
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const patch = (id: string, p: Partial<Block>) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...p } : b)));

  const addBlock = (preset: Preset) => {
    const id = `b${idRef.current++}`;
    setBlocks((prev) => [...prev, { id, ...PRESETS[preset].base }]);
    setSelectedId(id);
  };

  const applyTemplate = (t: TemplateId) => {
    const next = pickTemplate(t, headlineSuggestion).map((b) => ({ ...b, id: `b${idRef.current++}` }));
    setBlocks(next);
    setBand(TEMPLATES[t].band);
    setSelectedId(next[0]?.id ?? null);
  };

  const pullHeadline = () => {
    if (!headlineSuggestion?.trim()) return;
    const id = `b${idRef.current++}`;
    setBlocks((prev) => [...prev, { id, ...PRESETS.title.base, text: headlineSuggestion.trim() }]);
    setSelectedId(id);
  };

  // 표제 칩 — 첫(주표제) 블록이 있으면 그 text 를 교체, 없으면 타이틀 블록으로 추가.
  const injectOverlayHeadline = (text: string) => {
    setBlocks((prev) => {
      if (prev.length === 0) {
        const id = `b${idRef.current++}`;
        setSelectedId(id);
        return [{ id, ...PRESETS.title.base, text }];
      }
      setSelectedId(prev[0].id);
      return prev.map((b, i) => (i === 0 ? { ...b, text } : b));
    });
  };

  // 크기 ±스텝 — 이산 세그먼트를 벗어나면 무선택. 범위는 구조적으로 고정.
  const stepSize = (id: string, cur: number, dir: 1 | -1) =>
    patch(id, { fontPct: Math.min(SIZE_MAX, Math.max(SIZE_MIN, cur + dir * SIZE_STEP)) });

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  };

  // 드래그 — surface rect 기준 pct 환산.
  const onPointerDown = (e: React.PointerEvent, b: Block) => {
    e.preventDefault();
    setSelectedId(b.id);
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const curX = (b.xPct / 100) * rect.width;
    const curY = (b.yPct / 100) * rect.height;
    dragRef.current = { id: b.id, dx: e.clientX - (rect.left + curX), dy: e.clientY - (rect.top + curY) };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const x = ((e.clientX - d.dx - rect.left) / rect.width) * 100;
    const y = ((e.clientY - d.dy - rect.top) / rect.height) * 100;
    patch(d.id, { xPct: Math.min(100, Math.max(0, x)), yPct: Math.min(100, Math.max(0, y)) });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const handleSave = async () => {
    const filled = blocks.filter((b) => b.text.trim());
    if (filled.length === 0) {
      onSave(null); // 텍스트 없음 → 베이스로 되돌림
      onClose();
      return;
    }
    setSaving(true);
    try {
      const dataUrl = await compose(baseImageUrl, filled, band);
      onSave(dataUrl);
      onClose();
    } catch (err) {
      console.error("[text-overlay-compose]", err);
      showToast("이미지 합성에 실패했어요, 다시 시도해주세요");
    } finally {
      setSaving(false);
    }
  };

  const overlay = (
    <div
      ref={surfaceRef}
      style={{ position: "absolute", inset: 0, containerType: "inline-size", touchAction: "none" }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {band && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: `${BAND_HEIGHT_PCT}%`,
            ...(band === "bottom" ? { bottom: 0 } : { top: 0 }),
            background:
              band === "bottom"
                ? `linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,${BAND_DARK}))`
                : `linear-gradient(to top, rgba(0,0,0,0), rgba(0,0,0,${BAND_DARK}))`,
            pointerEvents: "none",
          }}
        />
      )}
      {blocks.map((b) => (
        <div
          key={b.id}
          onPointerDown={(e) => onPointerDown(e, b)}
          style={{
            position: "absolute",
            left: `${b.xPct}%`,
            top: `${b.yPct}%`,
            transform: "translate(-50%, -50%)",
            fontFamily: FONT_FAMILY,
            fontWeight: b.weight,
            fontSize: `${b.fontPct}cqw`,
            lineHeight: LINE_HEIGHT,
            color: b.color,
            textAlign: b.align,
            whiteSpace: "pre",
            cursor: "move",
            userSelect: "none",
            outline: selectedId === b.id ? "1.5px dashed rgba(255,255,255,0.9)" : "none",
            outlineOffset: "2px",
            textShadow: b.outline
              ? `0 ${b.fontPct * SOFT_OFFSET_RATIO}cqw ${b.fontPct * SOFT_BLUR_RATIO}cqw ${SOFT_SHADOW}, 0 0 ${b.fontPct * HALO_BLUR_RATIO}cqw ${haloColor(b.color)}`
              : "none",
          }}
        >
          {b.text || " "}
        </div>
      ))}
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="텍스트 편집"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 1000, padding: 24 }}
    >
      <div
        className="bg-[var(--w-bg-elevated)] rounded-2xl border border-[var(--w-line-normal)]"
        style={{ width: "min(960px, 96vw)", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--w-line-normal)]">
          <div className="font-bold text-[15px] text-[var(--w-fg-strong)]">텍스트 편집</div>
          <button type="button" aria-label="닫기" onClick={requestClose} className="grid place-items-center w-8 h-8 rounded-lg hover:bg-[var(--w-bg-neutral)]">
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* 본문: 좌 컨트롤 / 우 미리보기 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 0, minHeight: 0, flex: 1 }}>
          {/* 좌 — 컨트롤 패널 */}
          <div className="overflow-y-auto px-5 py-4" style={{ minWidth: 0 }}>
            <div style={{ marginBottom: 14 }}>
              <span className="font-semibold text-[12px] text-[var(--w-fg-neutral)]">시작 템플릿</span>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {(Object.keys(TEMPLATES) as TemplateId[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    aria-label={`템플릿 ${TEMPLATES[t].label}`}
                    className="flex flex-col items-center gap-1 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] py-2 hover:border-[var(--w-primary-normal)] transition-colors duration-[120ms]"
                  >
                    <TemplatePicto id={t} />
                    <span className="text-[10.5px] font-medium text-[var(--w-fg-neutral)] leading-none">{TEMPLATES[t].label}</span>
                  </button>
                ))}
              </div>
            </div>
            {headlineSuggestion?.trim() && (
              <button
                type="button"
                onClick={pullHeadline}
                className="flex items-center gap-1.5 w-full text-left rounded-xl border border-[var(--w-primary-normal)] bg-[var(--w-primary-assistive)] px-3 py-2.5 hover:bg-[var(--w-primary-normal)] hover:text-white transition-colors duration-[120ms] group"
                style={{ marginBottom: 14 }}
              >
                <Icon name="plus" size={14} />
                <span className="font-semibold text-[12.5px] text-[var(--w-primary-normal)] group-hover:text-white shrink-0">선택한 헤드라인 넣기</span>
                <span className="text-[12px] text-[var(--w-fg-neutral)] group-hover:text-white/80 truncate">{headlineSuggestion.trim()}</span>
              </button>
            )}
            {overlayHeadlines && overlayHeadlines.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <span className="font-semibold text-[12px] text-[var(--w-fg-neutral)]">표제 추천</span>
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  {overlayHeadlines.map((h, i) => (
                    <button
                      key={`${i}-${h}`}
                      type="button"
                      onClick={() => injectOverlayHeadline(h)}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] px-2.5 py-1 text-[12px] font-semibold text-[var(--w-fg-strong)] hover:border-[var(--w-primary-normal)] hover:text-[var(--w-primary-normal)] transition-colors duration-[120ms]"
                    >
                      <Icon name="plus" size={11} /> {h}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 14 }}>
              <span className="font-semibold text-[12px] text-[var(--w-fg-neutral)] mr-1">텍스트 추가</span>
              {(Object.keys(PRESETS) as Preset[]).map((k) => (
                <Button key={k} variant="ghost" size="sm" type="button" onClick={() => addBlock(k)} className="border border-[var(--w-line-normal)]">
                  {PRESETS[k].label}
                </Button>
              ))}
            </div>

            {blocks.length === 0 && (
              <p className="text-[12.5px] text-[var(--w-fg-neutral)] leading-[1.6]">위 버튼으로 타이틀·부제·후킹 문구를 추가하세요. 오른쪽 이미지에서 끌어 위치를 잡을 수 있어요.</p>
            )}

            <div className="flex flex-col gap-3">
              {blocks.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className="rounded-xl border bg-[var(--w-bg-elevated)] p-3"
                  style={{ borderColor: selectedId === b.id ? "var(--w-primary-normal)" : "var(--w-line-normal)" }}
                >
                  <div className="flex items-start gap-2">
                    <textarea
                      value={b.text}
                      onChange={(e) => patch(b.id, { text: e.target.value })}
                      rows={2}
                      placeholder="문구 입력 (줄바꿈 가능)"
                      className="flex-1 px-2.5 py-2 border border-[var(--w-line-normal)] rounded-lg bg-[var(--w-bg-elevated)] text-[13px] leading-[1.5] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] resize-y"
                    />
                    <button type="button" aria-label="블록 삭제" onClick={() => removeBlock(b.id)} className="grid place-items-center w-7 h-7 rounded-lg border border-[var(--w-line-normal)] text-[var(--w-fg-neutral)] hover:bg-[var(--w-bg-neutral)] shrink-0">
                      <Icon name="x" size={13} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                    {/* 폰트 (V1 = Pretendard 단일, 추후 확장) */}
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-[var(--w-fg-neutral)]">폰트</span>
                      <Select value="pretendard" onChange={() => {}} options={[{ value: "pretendard", label: "Pretendard" }]} />
                    </label>
                    {/* 크기 — S/M/L 세그먼트 + 미세조정 */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-[var(--w-fg-neutral)]">크기</span>
                      <div className="flex items-center gap-1.5">
                        <div className="inline-flex rounded-lg border border-[var(--w-line-normal)] overflow-hidden">
                          {SIZE_STEPS.map((s) => {
                            const active = b.fontPct === s.fontPct;
                            return (
                              <button key={s.label} type="button" onClick={() => patch(b.id, { fontPct: s.fontPct })} aria-label={`크기 ${s.label}`} aria-pressed={active} className="px-2.5 py-1 text-[12px] font-semibold" style={{ background: active ? "var(--w-primary-normal)" : "transparent", color: active ? "#fff" : "var(--w-fg-neutral)" }}>
                                {s.label}
                              </button>
                            );
                          })}
                        </div>
                        <button type="button" aria-label="크기 줄이기" onClick={() => stepSize(b.id, b.fontPct, -1)} className="grid place-items-center w-7 h-7 rounded-lg border border-[var(--w-line-normal)] text-[var(--w-fg-neutral)] hover:bg-[var(--w-bg-neutral)] text-[14px] font-bold shrink-0">−</button>
                        <button type="button" aria-label="크기 키우기" onClick={() => stepSize(b.id, b.fontPct, 1)} className="grid place-items-center w-7 h-7 rounded-lg border border-[var(--w-line-normal)] text-[var(--w-fg-neutral)] hover:bg-[var(--w-bg-neutral)] text-[14px] font-bold shrink-0">+</button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    {/* 색상 */}
                    <div className="flex items-center gap-1.5">
                      {SWATCHES.map((c) => (
                        <button key={c} type="button" aria-label={`색 ${c}`} onClick={() => patch(b.id, { color: c })} style={{ width: 18, height: 18, borderRadius: 5, background: c, border: b.color === c ? "2px solid var(--w-primary-normal)" : "1px solid var(--w-line-normal)" }} />
                      ))}
                      <input type="color" value={/^#[0-9a-f]{6}$/i.test(b.color) ? b.color : "#ffffff"} onChange={(e) => patch(b.id, { color: e.target.value })} style={{ width: 22, height: 22, padding: 0, border: "1px solid var(--w-line-normal)", borderRadius: 5, background: "none" }} aria-label="직접 색 선택" />
                    </div>

                    {/* 정렬 */}
                    <div className="inline-flex rounded-lg border border-[var(--w-line-normal)] overflow-hidden">
                      {([["left", "좌"], ["center", "중"], ["right", "우"]] as [Align, string][]).map(([a, lbl]) => (
                        <button key={a} type="button" onClick={() => patch(b.id, { align: a })} aria-label={`정렬 ${lbl}`} aria-pressed={b.align === a} className="px-2.5 py-1 text-[12px] font-semibold" style={{ background: b.align === a ? "var(--w-primary-normal)" : "transparent", color: b.align === a ? "#fff" : "var(--w-fg-neutral)" }}>
                          {lbl}
                        </button>
                      ))}
                    </div>

                    {/* 굵기 */}
                    <button type="button" onClick={() => patch(b.id, { weight: b.weight === 700 ? 400 : 700 })} aria-pressed={b.weight === 700} className="px-2.5 py-1 rounded-lg border text-[12px] font-bold" style={{ borderColor: b.weight === 700 ? "var(--w-primary-normal)" : "var(--w-line-normal)", color: b.weight === 700 ? "var(--w-primary-normal)" : "var(--w-fg-neutral)" }}>
                      굵게
                    </button>

                    {/* 외곽선 */}
                    <button type="button" onClick={() => patch(b.id, { outline: !b.outline })} aria-pressed={b.outline} className="px-2.5 py-1 rounded-lg border text-[12px] font-semibold" style={{ borderColor: b.outline ? "var(--w-primary-normal)" : "var(--w-line-normal)", color: b.outline ? "var(--w-primary-normal)" : "var(--w-fg-neutral)" }}>
                      외곽선
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 우 — 실시간 미리보기 */}
          <div className="bg-[var(--w-bg-alternative)] border-l border-[var(--w-line-normal)] overflow-y-auto px-4 py-4">
            <div className="text-[11px] font-semibold text-[var(--w-fg-neutral)] mb-2">미리보기</div>
            <IgPostPreview imageUrl={baseImageUrl} caption="" handle="my_brand" sponsored overlay={overlay} />
            <p className="text-[11px] text-[var(--w-fg-neutral)] leading-[1.5] mt-2">이미지 위 글자를 끌어 위치를 조정하세요. 저장 시 이미지로 합쳐져요.</p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[var(--w-line-normal)]">
          <Button variant="ghost" type="button" onClick={requestClose} className="border border-[var(--w-line-normal)]">취소</Button>
          <Button variant="primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "저장 중…" : "저장하기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
