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
import {
  BAND_HEIGHT_PCT,
  FONT_FAMILY,
  LINE_HEIGHT,
  PRESETS,
  TEMPLATES,
  bandGradient,
  compose,
  pickTemplate,
  previewTextShadow,
  type Band,
  type Align,
  type Block,
  type Preset,
  type TemplateId,
} from "@entities/creative/overlay-renderer";

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

// 화면 표시 순서 — 빈 시작/좌하단을 앞에, 밴드 계열을 뒤로.
const TEMPLATE_ORDER: TemplateId[] = ["D", "E", "A", "B", "C"];

const SWATCHES = ["#ffffff", "#000000", "#ffe14d", "#ff5a5f", "#0066ff"];

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
            background: bandGradient(band),
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
              textShadow: previewTextShadow(b),
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
                      <span className="text-[11px] font-medium text-[var(--w-fg-neutral)] leading-none">{TEMPLATES[t].label}</span>
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
                    <span className="font-semibold text-[13px] text-[var(--w-primary-normal)] group-hover:text-white shrink-0">선택한 헤드라인 넣기</span>
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
