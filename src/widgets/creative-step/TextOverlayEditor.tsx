"use client";

// 텍스트 편집(Text Overlay) — ADR-040 §6 후속. AI 모델이 못 그리는 한글을 클라이언트에서 직접 얹는다.
// 좌 = 컨트롤 패널(블록 자유 추가) / 우 = IgPostPreview 기반 실시간 합성 캔버스(드래그).
// 저장 = canvas 1024² 재드로잉 → PNG 스냅샷. 레이어 비영속(재오픈 = 깨끗한 베이스, ADR A 스코프).

import { useEffect, useRef, useState } from "react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Select } from "@shared/ui/Select";
import { useToast } from "@shared/ui/Toast";
import { IgPostPreview } from "@shared/ui/IgPostPreview";

const CANVAS_PX = 1024;
const FONT_FAMILY = "Pretendard";
const LINE_HEIGHT = 1.25;

type Align = "left" | "center" | "right";
type Preset = "title" | "subtitle" | "hook";

type Block = {
  id: string;
  text: string;
  xPct: number; // 박스 중심 x (0~100)
  yPct: number; // 박스 중심 y (0~100)
  fontPct: number; // 캔버스 폭 대비 글자 크기 %
  color: string;
  align: Align;
  weight: 400 | 700;
  outline: boolean; // 외곽선 + 그림자 (사진 위 가독성)
};

const PRESETS: Record<Preset, { label: string; base: Omit<Block, "id"> }> = {
  title: {
    label: "타이틀",
    base: { text: "타이틀을 입력하세요", xPct: 50, yPct: 18, fontPct: 9, color: "#ffffff", align: "center", weight: 400, outline: false },
  },
  subtitle: {
    label: "부제",
    base: { text: "부제를 입력하세요", xPct: 50, yPct: 31, fontPct: 5, color: "#ffffff", align: "center", weight: 400, outline: true },
  },
  hook: {
    label: "후킹 문구",
    base: { text: "지금 확인하세요", xPct: 50, yPct: 84, fontPct: 6.5, color: "#ffe14d", align: "center", weight: 700, outline: true },
  },
};

const SWATCHES = ["#ffffff", "#000000", "#ffe14d", "#ff5a5f", "#0066ff"];

// 크기 입력 — 자유 타이핑(빈칸 잠시 허용)이라 number 직바인딩 대신 로컬 string 으로 받는다.
// blur 시 비었거나 숫자가 아니면 직전 값으로 복원. min/max 제약 없음.
function SizeInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  return (
    <input
      type="number"
      inputMode="decimal"
      step={0.5}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = Number(e.target.value);
        if (e.target.value !== "" && !Number.isNaN(v)) onChange(v);
      }}
      onBlur={() => { if (text === "" || Number.isNaN(Number(text))) setText(String(value)); }}
      className="w-full px-3.5 py-3 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[14px] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] transition-[border-color,box-shadow] duration-[120ms]"
    />
  );
}

// hex 색의 밝기 → 외곽선 대비색 결정.
function isLightColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

// 캔버스로 베이스 이미지 + 텍스트 블록을 1024² PNG 로 굽는다.
async function compose(baseUrl: string, blocks: Block[]): Promise<string> {
  await Promise.all([
    document.fonts.load(`400 80px ${FONT_FAMILY}`),
    document.fonts.load(`700 80px ${FONT_FAMILY}`),
  ]).catch(() => {});

  const img = new Image();
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

    if (b.outline) {
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = fontPx * 0.12;
      ctx.lineJoin = "round";
      ctx.strokeStyle = isLightColor(b.color) ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)";
      ctx.lineWidth = fontPx * 0.08;
    } else {
      ctx.shadowBlur = 0;
    }

    lines.forEach((line, i) => {
      const y = top + i * lineH + lineH / 2;
      let x = cx;
      if (b.align === "left") { ctx.textAlign = "left"; x = leftEdge; }
      else if (b.align === "right") { ctx.textAlign = "right"; x = leftEdge + maxW; }
      else { ctx.textAlign = "center"; x = cx; }
      if (b.outline) ctx.strokeText(line, x, y);
      ctx.fillStyle = b.color;
      ctx.fillText(line, x, y);
    });
    ctx.shadowBlur = 0;
  }

  return canvas.toDataURL("image/png");
}

export default function TextOverlayEditor({
  baseImageUrl,
  onClose,
  onSave,
}: {
  baseImageUrl: string;
  onClose: () => void;
  onSave: (finalDataUrl: string | null) => void;
}) {
  const showToast = useToast();
  const [blocks, setBlocks] = useState<Block[]>([{ id: "b0", ...PRESETS.title.base }]);
  const [selectedId, setSelectedId] = useState<string | null>("b0");
  const [saving, setSaving] = useState(false);
  const idRef = useRef(1);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = (id: string, p: Partial<Block>) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...p } : b)));

  const addBlock = (preset: Preset) => {
    const id = `b${idRef.current++}`;
    setBlocks((prev) => [...prev, { id, ...PRESETS[preset].base }]);
    setSelectedId(id);
  };

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
      const dataUrl = await compose(baseImageUrl, filled);
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
      {blocks.map((b) => (
        <div
          key={b.id}
          onPointerDown={(e) => onPointerDown(e, b)}
          style={{
            position: "absolute",
            left: `${b.xPct}%`,
            top: `${b.yPct}%`,
            transform: "translate(-50%, -50%)",
            maxWidth: "94%",
            fontFamily: FONT_FAMILY,
            fontWeight: b.weight,
            fontSize: `${b.fontPct}cqw`,
            lineHeight: LINE_HEIGHT,
            color: b.color,
            textAlign: b.align,
            whiteSpace: "pre-wrap",
            cursor: "move",
            userSelect: "none",
            outline: selectedId === b.id ? "1.5px dashed rgba(255,255,255,0.9)" : "none",
            outlineOffset: "2px",
            textShadow: b.outline ? "0 1px 3px rgba(0,0,0,0.55)" : "none",
            WebkitTextStroke: b.outline
              ? `${b.fontPct * 0.035}cqw ${isLightColor(b.color) ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)"}`
              : undefined,
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
          <button type="button" aria-label="닫기" onClick={onClose} className="grid place-items-center w-8 h-8 rounded-lg hover:bg-[var(--w-bg-neutral)]">
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* 본문: 좌 컨트롤 / 우 미리보기 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 0, minHeight: 0, flex: 1 }}>
          {/* 좌 — 컨트롤 패널 */}
          <div className="overflow-y-auto px-5 py-4" style={{ minWidth: 0 }}>
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
                    {/* 크기 */}
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-[var(--w-fg-neutral)]">크기</span>
                      <SizeInput value={b.fontPct} onChange={(v) => patch(b.id, { fontPct: v })} />
                    </label>
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

                    {/* 외곽선/그림자 */}
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
          <Button variant="ghost" type="button" onClick={onClose} className="border border-[var(--w-line-normal)]">취소</Button>
          <Button variant="primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "저장 중…" : "저장하기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
