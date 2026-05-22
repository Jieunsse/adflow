"use client";

// STEP 01 AI 생성 결과 카드 — 스켈레톤 / 빈 상태 / 헤드라인 피커·본문·CTA·이미지 생성.

import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Skeleton } from "@shared/ui/Skeleton";
import { cn } from "@shared/lib/cn";
import AiImageBlock from "./AiImageBlock";

interface Props {
  generating: boolean;
  generated: boolean;
  headlines: string[] | null;
  headlineIdx: number;
  onSelectHeadline: (i: number) => void;
  primaryTexts: [string, string, string] | null;
  primaryTextIdx: number;
  onSelectPrimaryText: (i: number) => void;
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
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2" style={{ marginBottom: 18 }}>
            <label className="font-semibold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)] flex items-center gap-1.5">{p.primaryTexts ? "기본 텍스트 — 1개 선택" : "기본 텍스트"}</label>
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
                      <div className="font-[600] text-[11px] leading-none text-[var(--w-fg-neutral)] tracking-[0.04em] uppercase">VER 0{i + 1}</div>
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


          <AiImageBlock imageDataUrl={p.imageDataUrl} setImageDataUrl={p.setImageDataUrl} />

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
              <Button variant="primary" type="button" onClick={p.onNext}>다음: 광고 집행 <Icon name="arrow-right" size={14} /></Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
