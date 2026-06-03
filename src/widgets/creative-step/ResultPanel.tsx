"use client";

// STEP 01 AI 생성 결과 카드 — 스켈레톤 / 빈 상태 / 헤드라인 피커·본문·CTA·이미지 생성.

import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Skeleton } from "@shared/ui/Skeleton";
import { cn } from "@shared/lib/cn";
import { findHook, type CopyHook } from "@entities/creative/options";
import type { CreativeAttribution } from "@/lib/gemini-creative";
import type { ProfileNudge } from "@entities/creative/profile-nudge";

// ADR-052 — "전달한 재료(injected)" 칩 라벨.
const INJECTED_LABEL: Record<CreativeAttribution["injected"][number], string> = {
  tone: "톤",
  brandVoice: "브랜드 보이스",
  customerVoice: "고객의 말",
  imageGuide: "이미지 가이드",
  persona: "페르소나",
  product: "제품",
  copyReferences: "카피 문체",
};

interface Props {
  generating: boolean;
  generated: boolean;
  headlines: string[] | null;
  /** 헤드라인 후보와 짝 인덱스로 묶인 부제 후보 — 표시는 짝지어, 데이터는 후보 배열 유지(ADR-039 정합). */
  subtitles: string[] | null;
  /** 선택된 부제 (인라인 편집 대상). */
  subtitle: string;
  setSubtitle: (v: string) => void;
  headlineIdx: number;
  onSelectHeadline: (i: number) => void;
  primaryTexts: [string, string, string] | null;
  primaryTextIdx: number;
  onSelectPrimaryText: (i: number) => void;
  displayedHooks: [CopyHook, CopyHook, CopyHook] | null;
  proofPointsCited: [boolean, boolean, boolean] | null;
  primaryText: string;
  setPrimaryText: (v: string) => void;
  elapsed: number;
  onSaveToLibrary: () => void;
  saved: boolean;
  goLibrary: () => void;
  /** ADR-040 — phase 1(카피) → phase 2(이미지) 전환. */
  onGoImage: () => void;
  /** ADR-052 — 이 카피에 전달/반영된 브랜드 신호. */
  attribution: CreativeAttribution | null;
  /** ADR-052 — 빈 필드 보상 넛지(빈 필드 없으면 null). */
  nudge: ProfileNudge | null;
  onNudgeAdd: () => void;
  /** 넛지로 무언가 추가됐을 때의 라벨 — 있으면 "추가하고 다시 생성" 노출. */
  addedLabel: string | null;
  onRegenerate: () => void;
  /** A-lite before/after — 재생성 시 이전 안 1줄 + 변경 라벨. */
  beforeAfter: { before: string; label: string } | null;
}

export default function ResultPanel(p: Props) {
  return (
    <Card variant="lg" style={{ position: "sticky", top: 20 }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">AI 생성 결과</h2>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">헤드라인을 고르고, 본문을 다듬어 보세요.</p>
        </div>
        <Badge kind="violet"><Icon name="sparkles" size={12} /> AI 생성</Badge>
      </div>
      <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />

      {p.generating ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Skeleton style={{ height: 16, width: "40%" }} />
          <Skeleton style={{ height: 56 }} />
          <Skeleton style={{ height: 56 }} />
          <Skeleton style={{ height: 56 }} />
          <Skeleton style={{ height: 16, width: "30%", marginTop: 8 }} />
          <Skeleton style={{ height: 110 }} />
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
          {/* ADR-052 — A-lite before/after: 재생성 직전 안 1줄 + 변경 라벨 */}
          {p.beforeAfter && (
            <div className="flex items-start gap-2.5 px-[14px] py-3 rounded-xl bg-[var(--w-status-positive-soft)] border border-[var(--w-status-positive-line)]" style={{ marginBottom: 18 }}>
              <Icon name="check" size={15} className="text-[var(--w-status-positive)] mt-0.5 shrink-0" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-semibold text-[12.5px] leading-[1.4] text-[var(--w-fg-strong)]">
                  {p.beforeAfter.label} 반영해 다시 만들었어요
                </div>
                <p className="m-0 mt-1 font-medium text-[12px] leading-[1.5] text-[var(--w-fg-neutral)] truncate">
                  이전 안: {p.beforeAfter.before} <span className="text-[var(--w-fg-alternative)]">({p.beforeAfter.label} 미반영)</span>
                </p>
              </div>
            </div>
          )}

          {/* ADR-052 — 귀인 패널: 반영 ✓ (검증) / AI에 전달함 (주입) */}
          {p.attribution && (p.attribution.reflected.length > 0 || p.attribution.injected.length > 0) && (
            <div className="flex flex-col gap-2 px-[14px] py-3 rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)]" style={{ marginBottom: 18 }}>
              <span className="font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)]">이 카피에 쓰인 브랜드 정보</span>
              <div className="flex flex-wrap gap-1.5">
                {p.attribution.reflected.includes("proofPoints") && (
                  <span title="브랜드 근거 자료의 수치를 실제로 인용했어요 (ADR-031)" className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full bg-[var(--w-status-positive-soft)] text-[var(--w-green-700)] font-semibold text-[11.5px] leading-none">
                    <Icon name="check" size={11} /> 근거 자료 반영 ✓
                  </span>
                )}
                {p.attribution.injected.map((key) => (
                  <span key={key} title="AI에 전달한 재료예요. 출력 반영 여부는 검증하지 않아요." className="inline-flex items-center px-2.5 py-[3px] rounded-full border border-[var(--w-line-normal)] text-[var(--w-fg-normal)] font-medium text-[11.5px] leading-none">
                    {INJECTED_LABEL[key]} 전달함
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ADR-052 — 보상 넛지 / 추가 후 재생성 CTA */}
          {p.addedLabel ? (
            <div className="flex items-center gap-2.5 px-[14px] py-3 rounded-xl bg-[var(--w-primary-soft)] border border-[var(--w-primary-normal)]" style={{ marginBottom: 18 }}>
              <Icon name="sparkles" size={15} className="text-[var(--w-primary-press)] shrink-0" />
              <p className="m-0 font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-strong)]" style={{ flex: 1 }}>
                {p.addedLabel} 추가됨 — 다시 생성하면 카피에 반영돼요.
              </p>
              <Button variant="primary" size="sm" type="button" onClick={p.onRegenerate}>
                <Icon name="sparkles" size={12} /> 추가하고 다시 생성
              </Button>
            </div>
          ) : p.nudge ? (
            <div className="flex items-center gap-2.5 px-[14px] py-3 rounded-xl bg-[var(--w-accent-violet-soft)] border border-[var(--w-line-alternative)]" style={{ marginBottom: 18 }}>
              <Icon name="sparkles" size={15} className="text-[var(--w-accent-violet)] mt-0.5 shrink-0" />
              <p className="m-0 font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-normal)]" style={{ flex: 1 }}>
                {p.nudge.reason}
              </p>
              <Button variant="secondary" size="sm" type="button" onClick={p.onNudgeAdd}>추가하기</Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-2" style={{ marginBottom: 18 }}>
            <label className="font-semibold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] flex items-center gap-1.5">헤드라인 — 1개 선택</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {p.headlines.map((h, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 px-4 py-[14px] border border-[var(--w-line-normal)] rounded-xl cursor-pointer bg-[var(--w-bg-elevated)] transition-[border-color,background] duration-[120ms] hover:bg-[var(--w-bg-neutral)]",
                    p.headlineIdx === i && "border-[var(--w-primary-normal)] bg-[var(--w-primary-soft)]"
                  )}
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
                  <div className={cn(
                    "w-[18px] h-[18px] rounded-full border-[1.5px] border-[var(--w-line-normal)] flex-none mt-[1px] relative",
                    p.headlineIdx === i && "border-[var(--w-primary-normal)] after:content-[''] after:absolute after:inset-[3px] after:rounded-full after:bg-[var(--w-primary-normal)]"
                  )} />
                  <div style={{ flex: 1 }}>
                    <div className="font-[600] text-[11px] leading-none text-[var(--w-fg-neutral)] tracking-[0.04em] uppercase">VER 0{i + 1}</div>
                    <div className="font-[600] text-[14.5px] leading-[1.45] text-[var(--w-fg-strong)] mt-1">{h}</div>
                    {p.subtitles?.[i]?.trim() && (
                      <div className="font-medium text-[12.5px] leading-[1.4] text-[var(--w-fg-neutral)] mt-0.5">{p.subtitles[i]}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {p.subtitles && (
              <div className="flex flex-col gap-1.5 mt-1">
                <label className="font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)]">부제 — 이미지에 함께 얹혀요</label>
                <input
                  type="text"
                  value={p.subtitle}
                  onChange={(e) => p.setSubtitle(e.target.value)}
                  placeholder="헤드라인을 받쳐주는 짧은 한 마디"
                  className="w-full px-3 py-2 border border-[var(--w-line-normal)] rounded-lg bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-[1.5] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_var(--w-focus-ring)]"
                />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2" style={{ marginBottom: 18 }}>
            <label className="font-semibold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] flex items-center gap-1.5">{p.primaryTexts ? "기본 텍스트 — 1개 선택" : "기본 텍스트"}</label>
            {p.primaryTexts && (
              <p className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-neutral)] m-0 -mt-1">
                본문 3개는 서로 다른 설득 방식으로 썼어요. 마음에 드는 걸 고르세요.
              </p>
            )}
            {p.primaryTexts && (
              <p className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-alternative)] m-0">
                💡 제품 설명보다 고객의 상황·감정이 먼저 오나요? 한 번 더 확인해보세요.
              </p>
            )}
            {p.primaryTexts && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                {p.primaryTexts.map((t, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-3 px-4 py-[14px] border border-[var(--w-line-normal)] rounded-xl cursor-pointer bg-[var(--w-bg-elevated)] transition-[border-color,background] duration-[120ms] hover:bg-[var(--w-bg-neutral)]",
                      p.primaryTextIdx === i && "border-[var(--w-primary-normal)] bg-[var(--w-primary-soft)]"
                    )}
                    onClick={() => p.onSelectPrimaryText(i)}
                    role="radio"
                    aria-checked={p.primaryTextIdx === i}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        p.onSelectPrimaryText(i);
                      }
                    }}
                  >
                    <div className={cn(
                      "w-[18px] h-[18px] rounded-full border-[1.5px] border-[var(--w-line-normal)] flex-none mt-[1px] relative",
                      p.primaryTextIdx === i && "border-[var(--w-primary-normal)] after:content-[''] after:absolute after:inset-[3px] after:rounded-full after:bg-[var(--w-primary-normal)]"
                    )} />
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-2">
                        <div className="font-[600] text-[11px] leading-none text-[var(--w-fg-neutral)] tracking-[0.04em] uppercase">VER 0{i + 1}</div>
                        {p.displayedHooks?.[i] && (
                          <span title={findHook(p.displayedHooks[i]).uiDesc} className="inline-flex">
                            <Badge kind="violet">{findHook(p.displayedHooks[i]).ko} 방식</Badge>
                          </span>
                        )}
                        {p.proofPointsCited?.[i] && (
                          <span title="브랜드 근거 자료의 수치를 인용했어요 (ADR-031)" className="inline-flex">
                            <Badge kind="success">근거 ✓</Badge>
                          </span>
                        )}
                      </div>
                      <div className="font-[600] text-[14.5px] leading-[1.45] text-[var(--w-fg-strong)] mt-1">{t}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ font: "500 11.5px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
                {p.primaryTexts ? "선택 후 직접 편집할 수 있어요" : ""}
              </span>
              <span style={{ font: "500 11.5px/1 var(--w-font-mono)", color: "var(--w-fg-neutral)" }}>{p.primaryText.length} / 200자</span>
            </div>
            <textarea
              className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.6] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] resize-y min-h-[88px]"
              value={p.primaryText}
              onChange={(e) => p.setPrimaryText(e.target.value)}
              style={{ minHeight: 120 }}
            />
          </div>

          <div className="flex items-center justify-between gap-3" style={{ paddingTop: 16, borderTop: "1px solid var(--w-line-alternative)", flexWrap: "wrap", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-normal)" }}>
              <Icon name="check" size={14} style={{ color: "var(--w-status-positive)" }} />
              생성 완료 · {p.elapsed.toFixed(1)}s
            </span>
            <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              {p.saved ? (
                <Button variant="secondary" type="button" onClick={p.goLibrary} title="소재 라이브러리에서 보기">
                  <Icon name="check" size={14} style={{ color: "var(--w-status-positive)" }} />
                  라이브러리에 저장됨
                </Button>
              ) : (
                <Button variant="secondary" type="button" onClick={p.onSaveToLibrary}>
                  <Icon name="folder" size={14} /> 소재 라이브러리에 저장
                </Button>
              )}
              <Button variant="primary" type="button" onClick={p.onGoImage}>다음: 이미지 만들기 <Icon name="arrow-right" size={14} /></Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
