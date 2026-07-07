"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import { Dialog, DialogContent, DialogTitle } from "@shared/ui/Dialog";
import type { SopSection } from "@features/sop/model/useSopStorage";

// ADR-043 — 노션 자원 선택 + AI 가져오기 모달. Brand Profile 신규·편집 화면에서 호출.
export interface NotionResource {
  id: string;
  title: string;
  type: "page" | "data_source";
}

export interface NotionImportResult {
  style: {
    tone?: string;
    brandDescription?: string;
    brandVoice?: string;
    customerVoiceSummary?: string;
    imageGuide?: string;
  };
  proofPoints: string[];
  policy: SopSection[];
}

// browse 모드 mock(ADR-033 철학: 실 OAuth/Gemini 미사용)
const BROWSE_RESOURCES: NotionResource[] = [
  { id: "mock-brandbook", title: "브랜드북 — 그린루틴", type: "page" },
  { id: "mock-voice", title: "고객 리뷰 모음", type: "data_source" },
  { id: "mock-policy", title: "광고 가이드라인 / 금지어", type: "page" },
];

const BROWSE_RESULT: NotionImportResult = {
  style: {
    tone: "친근하고 진솔하게, 과장 없이",
    brandDescription: "20대 여성을 위한 비건 스킨케어 브랜드 '그린루틴'. 대표 제품은 수분크림으로 자극 없는 성분이 강점.",
    brandVoice: "담백하고 솔직하게. 효능을 과장하지 않고 성분으로 설득.",
    customerVoiceSummary: "'바르고 나면 촉촉해요', '향이 자극적이지 않아 좋아요'라는 리뷰가 많음.",
    imageGuide: "자연광 느낌의 밝은 톤. 배경은 흰색 또는 연한 베이지. 로고는 우측 하단.",
  },
  proofPoints: ["재구매율 73%", "누적 12만 개 판매", "별점 4.9 (리뷰 2,400건)"],
  policy: [
    { type: "prohibited_words", data: { words: ["완치", "100% 무자극"] }, source: "ai-classified" },
  ],
};

const ICON_BY_TYPE = { page: "doc", data_source: "grid" } as const;

export default function NotionImportModal({
  browseMode,
  onClose,
  onImport,
}: {
  browseMode: boolean;
  onClose: () => void;
  onImport: (result: NotionImportResult) => void;
}) {
  const [resources, setResources] = useState<NotionResource[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<"not_connected" | "failed" | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (browseMode) {
      setResources(BROWSE_RESOURCES);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/notion/search");
        if (res.status === 403) { if (alive) setLoadError("not_connected"); return; }
        if (!res.ok) { if (alive) setLoadError("failed"); return; }
        const data = (await res.json()) as { resources: NotionResource[] };
        if (alive) setResources(data.resources);
      } catch {
        if (alive) setLoadError("failed");
      }
    })();
    return () => { alive = false; };
  }, [browseMode]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleImport = async () => {
    const picked = (resources ?? []).filter((r) => selected.has(r.id));
    if (picked.length === 0) return;
    setImporting(true);
    setImportError(null);
    if (browseMode) {
      setTimeout(() => onImport(BROWSE_RESULT), 600);
      return;
    }
    try {
      const res = await fetch("/api/notion/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resources: picked }),
      });
      const data = (await res.json()) as NotionImportResult & { error?: string };
      if (!res.ok) { setImportError(data.error ?? "가져오기에 실패했어요."); setImporting(false); return; }
      onImport(data);
    } catch {
      setImportError("가져오기에 실패했어요. 다시 시도해주세요.");
      setImporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{ width: 520 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="m-0 font-bold text-[18px] leading-[1.3] tracking-[-0.016em] text-[var(--w-fg-strong)]">노션에서 가져오기</DialogTitle>
            <p className="m-0 mt-1.5 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">
              가져올 페이지·데이터베이스를 선택하면 AI가 브랜드 프로필의 빈 칸을 채워줘요.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]">
            <Icon name="x" size={18} />
          </button>
        </div>

        {loadError === "not_connected" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="w-11 h-11 rounded-xl grid place-items-center bg-[rgba(255,146,0,0.12)] text-[var(--w-status-cautionary)]"><Icon name="warn" size={20} /></div>
            <p className="m-0 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-neutral)]">
              노션 워크스페이스가 연결되지 않았어요.<br />연결 탭에서 먼저 연결해주세요.
            </p>
            <Link href="/connect" className="no-underline">
              <Button variant="primary" size="sm" type="button"><Icon name="link" size={13} /> 연결하러 가기</Button>
            </Link>
          </div>
        ) : loadError === "failed" ? (
          <div className="py-8 text-center font-medium text-[14px] text-[var(--w-fg-neutral)]">
            노션 자료를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
          </div>
        ) : resources === null ? (
          <div className="py-8 text-center font-medium text-[14px] text-[var(--w-fg-neutral)]">불러오는 중…</div>
        ) : resources.length === 0 ? (
          <div className="py-8 text-center font-medium text-[14px] text-[var(--w-fg-neutral)]">
            AdFlow와 공유된 노션 페이지가 없어요. 노션에서 페이지를 공유한 뒤 다시 열어 주세요.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-[44vh] overflow-y-auto -mx-1 px-1">
            {resources.map((r) => {
              const checked = selected.has(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(r.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors",
                    checked
                      ? "border-[var(--w-primary-normal)] bg-[var(--w-primary-soft)]"
                      : "border-[var(--w-line-normal)] hover:bg-[var(--w-bg-neutral)]",
                  )}
                >
                  <span className={cn(
                    "w-[18px] h-[18px] rounded-[6px] grid place-items-center flex-none border",
                    checked ? "bg-[var(--w-primary-normal)] border-[var(--w-primary-normal)] text-white" : "border-[var(--w-line-normal)]",
                  )}>
                    {checked && <Icon name="check" size={11} strokeWidth={3} />}
                  </span>
                  <Icon name={ICON_BY_TYPE[r.type]} size={15} />
                  <span className="flex-1 min-w-0 font-medium text-[14px] leading-[1.4] text-[var(--w-fg-strong)] truncate">{r.title}</span>
                  <span className="font-medium text-[12px] text-[var(--w-fg-alternative)] flex-none">{r.type === "page" ? "페이지" : "DB"}</span>
                </button>
              );
            })}
          </div>
        )}

        {importError && (
          <div className="font-medium text-[13px] text-[var(--w-status-negative)]">{importError}</div>
        )}

        {resources !== null && resources.length > 0 && !loadError && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="font-medium text-[13px] text-[var(--w-fg-neutral)]">{selected.size}개 선택됨</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={onClose}>취소</Button>
              <Button variant="primary" size="sm" type="button" onClick={handleImport} disabled={selected.size === 0 || importing}>
                {importing ? "가져오는 중…" : "가져오기"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
