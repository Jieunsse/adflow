"use client";

// 텍스트 편집(Text Overlay) — ADR-040 §6 후속, ADR-058 표제 템플릿 위에 인라인 편집 UX 재설계.
// AI 모델이 못 그리는 한글을 클라이언트에서 직접 얹는다. 미리보기 중심 단일열 + contentEditable 인라인 편집.
// 저장 = canvas 1024² 재드로잉 → PNG 스냅샷. 레이어 비영속(재오픈 = 깨끗한 베이스, CONTEXT Text Overlay V1 A 스코프).

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
export type TemplateId = "A" | "B" | "C" | "D" | "E";
// 화면 표시 순서 — 빈 시작/좌하단을 앞에, 밴드 계열을 뒤로.
const TEMPLATE_ORDER: TemplateId[] = ["D", "E", "A", "B", "C"];
type Band = "top" | "bottom" | null;

export type Block = {
  id: string;
  text: string;
  xPct: number; // 박스 앵커 x (0~100) — align 에 따라 left%/transform 이 정렬 흡수
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

// 시작 템플릿 5종 — 주표제/보조 블록을 결정적으로 배치. band 는 Block 모델 밖 템플릿 속성.
export const TEMPLATES: Record<TemplateId, { label: string; band: Band; blocks: Omit<Block, "id">[] }> = {
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
  E: {
    label: "좌하단", band: "bottom",
    blocks: [
      TITLE_BASE({ align: "left", xPct: 6, yPct: 80, fontPct: 6.5 }),
      TITLE_BASE({ align: "left", xPct: 6, yPct: 89, fontPct: 4, weight: 400 }),
    ],
  },
};

// 템플릿 → Block[]. 주표제(첫 블록)=headline, 보조(둘째 블록)=subtitle 자동 주입(없으면 placeholder).
export function pickTemplate(t: TemplateId, headline?: string, subtitle?: string): Block[] {
  const tpl = TEMPLATES[t];
  return tpl.blocks.map((base, i) => ({
    id: `t${t}-${i}`,
    ...base,
    text:
      i === 0
        ? headline?.trim() || "여기에 표제를 입력하세요"
        : i === 1
          ? subtitle?.trim() || "부가 문구"
          : "부가 문구",
  }));
}

// 정렬 앵커 — center=박스 중심(현행 비트동일), left=좌모서리, right=우모서리.
// canvas/미리보기 공유 순수함수. cx=앵커 x(px), maxW=가장 긴 줄 폭(px).
export function resolveAnchor(align: Align, cx: number, maxW: number): { textAlign: CanvasTextAlign; x: number } {
  if (align === "left") return { textAlign: "left", x: cx };
  if (align === "right") return { textAlign: "right", x: cx };
  return { textAlign: "center", x: cx };
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

// 템플릿 픽토그램 — 단색 토큰 도형(32×32). A 하단·B 상단·C 중앙·D 빈(점선)·E 좌하단.
function TemplatePicto({ id }: { id: TemplateId }) {
  const fill = "var(--w-fg-neutral)";
  return (
    <svg width={32} height={32} viewBox="0 0 32 32" aria-hidden="true">
      <rect x={3} y={3} width={26} height={26} rx={3} fill="none" stroke="var(--w-line-normal)" strokeWidth={1.5} strokeDasharray={id === "D" ? "3 3" : undefined} />
      {id === "A" && (<><rect x={8} y={20} width={16} height={3} rx={1.5} fill={fill} /><rect x={11} y={25} width={10} height={1.5} rx={0.75} fill={fill} /></>)}
      {id === "B" && (<><rect x={8} y={7} width={16} height={3} rx={1.5} fill={fill} /><rect x={11} y={12} width={10} height={1.5} rx={0.75} fill={fill} /></>)}
      {id === "C" && <rect x={6} y={15} width={20} height={3.5} rx={1.75} fill={fill} />}
      {id === "E" && (<><rect x={6} y={20} width={14} height={3} rx={1.5} fill={fill} /><rect x={6} y={25} width={9} height={1.5} rx={0.75} fill={fill} /></>)}
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
    const top = cy - (lines.length * lineH) / 2;

    lines.forEach((line, i) => {
      const y = top + i * lineH + lineH / 2;
      const { textAlign, x } = resolveAnchor(b.align, cx, maxW);
      ctx.textAlign = textAlign;

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

// align → 미리보기 div transform(앵커=left%, transform 이 정렬 흡수).
function anchorTransform(align: Align): string {
  if (align === "left") return "translate(0, -50%)";
  if (align === "right") return "translate(-100%, -50%)";
  return "translate(-50%, -50%)";
}

// contentEditable 확정 텍스트 정규화 — nbsp→공백, 과한 빈 줄 축소.
function normalizeText(raw: string): string {
  return raw.replace(/ /g, " ").replace(/\n{3,}/g, "\n\n");
}

export default function TextOverlayEditor({
  baseImageUrl,
  headlineSuggestion,
  subtitleSuggestion,
  onClose,
  onSave,
}: {
  baseImageUrl: string;
  headlineSuggestion?: string;
  // 선택된 카피의 부제 — 헤드라인과 함께 자동 시드(ADR-058, 이 케이스에 한해 ADR-056 ① pull-only supersede).
  subtitleSuggestion?: string;
  // 표제 추천 풀 — 계약 보존(ADR-058). 현 UX(V1)에서 칩 표면은 미노출.
  overlayHeadlines?: string[];
  onClose: () => void;
  onSave: (finalDataUrl: string | null) => void;
}) {
  const showToast = useToast();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [band, setBand] = useState<Band>(null);
  const [saving, setSaving] = useState(false);
  const idRef = useRef(1);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const editRef = useRef<HTMLDivElement | null>(null);
  const isComposingRef = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  const requestClose = () => {
    const hasFilled = blocks.some((b) => b.text.trim());
    if (hasFilled && !window.confirm("닫으면 텍스트가 사라져요. 저장하면 이미지로 합쳐집니다.")) return;
    onClose();
  };

  // 편집 진입 시 ref 포커스 + 캐럿을 끝으로.
  useEffect(() => {
    if (!editingId) return;
    const el = editRef.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editingId]);

  // Esc — 편집 중이면 편집만 종료(모달 닫기와 분기), 아니면 requestClose.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (editingId) { e.stopPropagation(); setEditingId(null); return; }
      requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Delete/Backspace — 비편집·비입력 상태에서 선택 블록 삭제.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (editingId) return;
      if (e.target instanceof HTMLInputElement) return;
      if (selectedId) { e.preventDefault(); removeBlock(selectedId); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // 포커스 트랩 — 마운트 시 닫기 버튼에 포커스, Tab 을 모달 내 첫/끝 포커스 가능 요소로 순환.
  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const root = modalRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]',
        ),
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const patch = (id: string, p: Partial<Block>) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...p } : b)));

  const addBlock = (preset: Preset) => {
    const id = `b${idRef.current++}`;
    setBlocks((prev) => [...prev, { id, ...PRESETS[preset].base }]);
    setSelectedId(id);
  };

  const applyTemplate = (t: TemplateId) => {
    setEditingId(null);
    const next = pickTemplate(t, headlineSuggestion, subtitleSuggestion).map((b) => ({ ...b, id: `b${idRef.current++}` }));
    setBlocks(next);
    setBand(TEMPLATES[t].band);
    setSelectedId(next[0]?.id ?? null);
  };

  // ADR-058 — 헤드라인+부제 자동 시드. 마운트 시 1회, 헤드라인이 있으면 "좌하단"(밴드+위계 2:1) 으로 배치.
  // ADR-056 ① pull-only 를 이 진입 케이스에 한해 supersede(부제까지 짝으로 시드된 카피가 있을 때만).
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (!headlineSuggestion?.trim()) return;
    setBand(TEMPLATES.E.band);
    const seeded = pickTemplate("E", headlineSuggestion, subtitleSuggestion)
      .filter((b) => b.text.trim() && b.text !== "부가 문구") // 빈 부제는 블록 생략
      .map((b) => ({ ...b, id: `b${idRef.current++}` }));
    setBlocks(seeded);
    setSelectedId(seeded[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pullHeadline = () => {
    if (!headlineSuggestion?.trim()) return;
    const id = `b${idRef.current++}`;
    setBlocks((prev) => [...prev, { id, ...PRESETS.title.base, text: headlineSuggestion.trim() }]);
    setSelectedId(id);
  };

  // 크기 ±스텝 — 이산 세그먼트를 벗어나면 무선택. 범위는 구조적으로 고정.
  const stepSize = (id: string, cur: number, dir: 1 | -1) =>
    patch(id, { fontPct: Math.min(SIZE_MAX, Math.max(SIZE_MIN, cur + dir * SIZE_STEP)) });

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setSelectedId((s) => (s === id ? null : s));
    setEditingId((e) => (e === id ? null : e));
  };

  // 인라인 편집 확정 — innerText 회수, 정규화, 빈 텍스트면 삭제.
  const commitEdit = (id: string) => {
    const el = editRef.current;
    setEditingId(null);
    if (!el) return;
    const raw = el.innerText;
    if (!raw.trim()) { removeBlock(id); return; }
    patch(id, { text: normalizeText(raw) });
  };

  const enterEdit = (b: Block) => {
    setSelectedId(b.id);
    setEditingId(b.id);
  };

  // 드래그 — surface rect 기준 pct 환산. 편집 중 블록은 드래그 차단.
  const onPointerDown = (e: React.PointerEvent, b: Block) => {
    if (editingId === b.id) return;
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

  // 방향키 이동 — 선택 블록 1%/Shift 5%. (도크·편집 중이 아닐 때)
  const onBlockKeyDown = (e: React.KeyboardEvent, b: Block) => {
    if (editingId === b.id) return;
    if (e.key === "Enter") { e.preventDefault(); enterEdit(b); return; }
    const d = e.shiftKey ? 5 : 1;
    let { xPct, yPct } = b;
    if (e.key === "ArrowLeft") xPct -= d;
    else if (e.key === "ArrowRight") xPct += d;
    else if (e.key === "ArrowUp") yPct -= d;
    else if (e.key === "ArrowDown") yPct += d;
    else return;
    e.preventDefault();
    patch(b.id, { xPct: Math.min(100, Math.max(0, xPct)), yPct: Math.min(100, Math.max(0, yPct)) });
  };

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
      {blocks.length === 0 && (
        <div
          onDoubleClick={() => addBlock("title")}
          className="absolute inset-0 grid place-items-center"
          style={{ pointerEvents: "auto", cursor: "text" }}
        >
          <span className="rounded-lg border border-dashed border-white/70 bg-black/25 px-3 py-2 text-[12px] font-medium text-white/90 text-center leading-[1.5]">
            더블클릭으로 글자 추가
            <br />
            또는 오른쪽에서 템플릿 선택
          </span>
        </div>
      )}
      {blocks.map((b) => {
        const editing = editingId === b.id;
        const isSel = selectedId === b.id;
        return (
          <div
            key={b.id}
            ref={editing ? editRef : undefined}
            tabIndex={0}
            role="button"
            aria-label={`텍스트 블록: ${b.text || "빈 텍스트"}`}
            contentEditable={editing}
            suppressContentEditableWarning
            onPointerDown={(e) => onPointerDown(e, b)}
            onDoubleClick={() => enterEdit(b)}
            onKeyDown={(e) => onBlockKeyDown(e, b)}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
              const el = editRef.current;
              if (el) patch(b.id, { text: normalizeText(el.innerText) });
            }}
            onInput={() => {
              if (isComposingRef.current) return;
              const el = editRef.current;
              if (el) patch(b.id, { text: normalizeText(el.innerText) });
            }}
            onBlur={() => { if (editing) commitEdit(b.id); }}
            style={{
              position: "absolute",
              left: `${b.xPct}%`,
              top: `${b.yPct}%`,
              transform: anchorTransform(b.align),
              fontFamily: FONT_FAMILY,
              fontWeight: b.weight,
              fontSize: `${b.fontPct}cqw`,
              lineHeight: LINE_HEIGHT,
              color: b.color,
              textAlign: b.align,
              whiteSpace: "pre",
              caretColor: "var(--w-primary-normal)",
              cursor: editing ? "text" : "move",
              userSelect: editing ? "text" : "none",
              outline: editing
                ? "2px solid var(--w-primary-normal)"
                : isSel
                  ? "1.5px dashed rgba(255,255,255,0.9)"
                  : "none",
              outlineOffset: "2px",
              boxShadow: editing ? "0 0 0 4px var(--w-focus-ring)" : "none",
              textShadow: b.outline
                ? `0 ${b.fontPct * SOFT_OFFSET_RATIO}cqw ${b.fontPct * SOFT_BLUR_RATIO}cqw ${SOFT_SHADOW}, 0 0 ${b.fontPct * HALO_BLUR_RATIO}cqw ${haloColor(b.color)}`
                : "none",
            }}
          >
            {/* 편집 중엔 React 미제어 — 조합 중 re-render 가 DOM 을 덮어 한글 자모 깨지는 것 차단 */}
            {editing ? undefined : (b.text || " ")}
          </div>
        );
      })}
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
        ref={modalRef}
        className="bg-[var(--w-bg-elevated)] rounded-2xl border border-[var(--w-line-normal)]"
        style={{ width: "min(960px, 94vw)", height: "min(680px, 90vh)", display: "grid", gridTemplateRows: "auto 1fr auto", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--w-line-normal)]">
          <div className="w-h4">텍스트 편집</div>
          <button ref={closeBtnRef} type="button" aria-label="닫기" onClick={requestClose} className="grid place-items-center w-8 h-8 rounded-lg hover:bg-[var(--w-bg-neutral)]">
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* 본문 — 2-column (좌 미리보기 sticky / 우 컨트롤 스크롤). 720px 컨테이너 쿼리로 세로 스택 폴백 */}
        <div className="to-editor-body">
          <div className="to-editor-grid">
            {/* 좌 — 라이브 미리보기 (스크롤 없음, width clamp 만) */}
            <div className="to-editor-preview bg-[var(--w-bg-alternative)]">
              <div style={{ width: "min(100%, 440px)", margin: "0 auto" }}>
                <IgPostPreview imageUrl={baseImageUrl} caption="" handle="my_brand" sponsored overlay={overlay} />
              </div>
            </div>

            {/* 우 — 컨트롤 패널 (세로 배치, 스크롤 + 하단 fade mask) */}
            <div className="to-editor-controls-wrap">
              <div className="to-editor-controls px-5 py-4">
                {/* 시작 템플릿 */}
                <div className="w-overline mb-2">시작 템플릿</div>
                <div className="grid grid-cols-5 gap-2">
                  {TEMPLATE_ORDER.map((t) => (
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

                {/* 선택한 헤드라인 넣기 (pull, 자동 X) */}
                {headlineSuggestion?.trim() && (
                  <button
                    type="button"
                    onClick={pullHeadline}
                    className="flex items-center gap-1.5 w-full text-left rounded-xl border border-[var(--w-primary-normal)] bg-[var(--w-primary-soft)] px-3 py-2 hover:bg-[var(--w-primary-normal)] hover:text-white transition-colors duration-[120ms] group mt-3"
                  >
                    <Icon name="plus" size={14} />
                    <span className="font-semibold text-[12.5px] text-[var(--w-primary-normal)] group-hover:text-white shrink-0">선택한 헤드라인 넣기</span>
                    <span className="text-[12px] text-[var(--w-fg-neutral)] group-hover:text-white/80 truncate">{headlineSuggestion.trim()}</span>
                  </button>
                )}

                {/* 텍스트 추가 */}
                <div className="w-overline mt-4 mb-2">텍스트 추가</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(Object.keys(PRESETS) as Preset[]).map((k) => (
                    <Button key={k} variant="ghost" size="sm" type="button" onClick={() => addBlock(k)} className="border border-[var(--w-line-normal)]">
                      {PRESETS[k].label}
                    </Button>
                  ))}
                </div>

                <div className="border-t border-[var(--w-line-normal)] my-4" />

                {/* 선택 블록 컨트롤 (세로 배치) / 힌트 */}
                {selected ? (
                  <div className="flex flex-col gap-4 animate-[fadeIn_120ms_ease]">
                    {/* 글꼴 (V1 = Pretendard 단일) */}
                    <div>
                      <div className="w-overline mb-1.5">글꼴</div>
                      <Select value="pretendard" onChange={() => {}} options={[{ value: "pretendard", label: "Pretendard" }]} />
                    </div>

                    {/* 크기 — S/M/L/XL 세그먼트 + 미세조정 */}
                    <div>
                      <div className="w-overline mb-1.5">크기</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="inline-flex rounded-lg border border-[var(--w-line-normal)] overflow-hidden">
                          {SIZE_STEPS.map((s) => {
                            const active = selected.fontPct === s.fontPct;
                            return (
                              <button key={s.label} type="button" onClick={() => patch(selected.id, { fontPct: s.fontPct })} aria-label={`크기 ${s.label}`} aria-pressed={active} className="w-caption px-2.5 py-1" style={{ background: active ? "var(--w-primary-normal)" : "transparent", color: active ? "#fff" : "var(--w-fg-neutral)" }}>
                                {s.label}
                              </button>
                            );
                          })}
                        </div>
                        <button type="button" aria-label="크기 줄이기" onClick={() => stepSize(selected.id, selected.fontPct, -1)} className="grid place-items-center w-7 h-7 rounded-lg border border-[var(--w-line-normal)] text-[var(--w-fg-neutral)] hover:bg-[var(--w-bg-neutral)] text-[14px] font-bold shrink-0">−</button>
                        <button type="button" aria-label="크기 키우기" onClick={() => stepSize(selected.id, selected.fontPct, 1)} className="grid place-items-center w-7 h-7 rounded-lg border border-[var(--w-line-normal)] text-[var(--w-fg-neutral)] hover:bg-[var(--w-bg-neutral)] text-[14px] font-bold shrink-0">+</button>
                      </div>
                    </div>

                    {/* 색상 */}
                    <div>
                      <div className="w-overline mb-1.5">색상</div>
                      <div className="flex items-center gap-1.5">
                        {SWATCHES.map((c) => (
                          <button key={c} type="button" aria-label={`색 ${c}`} onClick={() => patch(selected.id, { color: c })} style={{ width: 18, height: 18, borderRadius: 5, background: c, border: selected.color === c ? "2px solid var(--w-primary-normal)" : "1px solid var(--w-line-normal)" }} />
                        ))}
                        <input type="color" value={/^#[0-9a-f]{6}$/i.test(selected.color) ? selected.color : "#ffffff"} onChange={(e) => patch(selected.id, { color: e.target.value })} style={{ width: 22, height: 22, padding: 0, border: "1px solid var(--w-line-normal)", borderRadius: 5, background: "none" }} aria-label="직접 색 선택" />
                      </div>
                    </div>

                    {/* 정렬 */}
                    <div>
                      <div className="w-overline mb-1.5">정렬</div>
                      <div className="inline-flex rounded-lg border border-[var(--w-line-normal)] overflow-hidden">
                        {([["left", "좌"], ["center", "중"], ["right", "우"]] as [Align, string][]).map(([a, lbl]) => (
                          <button key={a} type="button" onClick={() => patch(selected.id, { align: a })} aria-label={`정렬 ${lbl}`} aria-pressed={selected.align === a} className="w-caption px-2.5 py-1" style={{ background: selected.align === a ? "var(--w-primary-normal)" : "transparent", color: selected.align === a ? "#fff" : "var(--w-fg-neutral)" }}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 스타일 — 굵게 / 외곽선 */}
                    <div>
                      <div className="w-overline mb-1.5">스타일</div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => patch(selected.id, { weight: selected.weight === 700 ? 400 : 700 })} aria-pressed={selected.weight === 700} className="w-caption px-2.5 py-1 rounded-lg border" style={{ fontWeight: 700, borderColor: selected.weight === 700 ? "var(--w-primary-normal)" : "var(--w-line-normal)", color: selected.weight === 700 ? "var(--w-primary-normal)" : "var(--w-fg-neutral)" }}>
                          굵게
                        </button>
                        <button type="button" onClick={() => patch(selected.id, { outline: !selected.outline })} aria-pressed={selected.outline} className="w-caption px-2.5 py-1 rounded-lg border" style={{ borderColor: selected.outline ? "var(--w-primary-normal)" : "var(--w-line-normal)", color: selected.outline ? "var(--w-primary-normal)" : "var(--w-fg-neutral)" }}>
                          외곽선
                        </button>
                        <button type="button" aria-label="블록 삭제" onClick={() => removeBlock(selected.id)} className="grid place-items-center w-7 h-7 rounded-lg border border-[var(--w-line-normal)] text-[var(--w-fg-neutral)] hover:bg-[var(--w-bg-neutral)] shrink-0 ml-auto">
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="w-caption leading-[1.6] m-0">
                    이미지 위 글자를 더블클릭해 편집하거나, 끌어서 위치를 옮기세요. 위에서 템플릿을 골라 시작할 수도 있어요.
                  </p>
                )}
              </div>
            </div>
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
