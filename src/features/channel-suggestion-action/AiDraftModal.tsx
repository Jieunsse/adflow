"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import { Dialog, DialogContent, DialogTitle } from "@shared/ui/Dialog";

export type DraftChannel = "instagram" | "facebook";

export type ChannelDraftResult = {
  caption: string;
  hashtags: string[];
  imagePrompt: string;
};

type Props = {
  channel: DraftChannel;
  suggestionTitle: string;
  suggestionDetail: string[];
  onClose: () => void;
};

type Status = "loading" | "ready" | "error";

async function fetchDraft(channel: DraftChannel, title: string, detail: string[]): Promise<ChannelDraftResult> {
  const res = await fetch("/api/channel-suggestion/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel, suggestionTitle: title, suggestionDetail: detail }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "초안을 만들지 못했어요");
  }
  return (await res.json()) as ChannelDraftResult;
}

export default function AiDraftModal({ channel, suggestionTitle, suggestionDetail, onClose }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [draft, setDraft] = useState<ChannelDraftResult | null>(null);
  const [error, setError] = useState<string>("");
  const [copyHint, setCopyHint] = useState<string>("");
  const isIg = channel === "instagram";

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchDraft(channel, suggestionTitle, suggestionDetail)
      .then((d) => { if (!cancelled) { setDraft(d); setStatus("ready"); } })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "초안을 만들지 못했어요");
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [channel, suggestionTitle, suggestionDetail]);

  const regenerate = () => {
    setStatus("loading");
    setError("");
    fetchDraft(channel, suggestionTitle, suggestionDetail)
      .then((d) => { setDraft(d); setStatus("ready"); })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "초안을 만들지 못했어요");
        setStatus("error");
      });
  };

  const copy = async (text: string, hint: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint(`${hint} 복사 완료`);
      setTimeout(() => setCopyHint(""), 1600);
    } catch {
      setCopyHint("복사 실패 — 직접 선택해서 복사해주세요");
    }
  };

  const fullText = draft
    ? [draft.caption, draft.hashtags.length > 0 ? draft.hashtags.join(" ") : "", `이미지 프롬프트: ${draft.imagePrompt}`].filter(Boolean).join("\n\n")
    : "";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{ width: 560 }} className="flex flex-col p-0">
        <DialogTitle className="sr-only">AI 콘텐츠 초안</DialogTitle>
        <div className="px-[26px] pt-[26px] pb-2">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-[10px] bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] grid place-items-center">
              <Icon name="info" size={18} />
            </div>
            <span className="font-semibold text-[11px] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">AI 콘텐츠 초안 · {isIg ? "Instagram" : "Facebook"}</span>
          </div>
          <h3 className="m-0 font-bold text-[17px] leading-[1.35] tracking-[-0.01em] text-[var(--w-fg-strong)]">{suggestionTitle}</h3>
          <p className="font-medium text-[12.5px] leading-[1.55] text-[var(--w-fg-neutral)] mt-1.5 mb-0">
            {isIg
              ? "캡션을 다듬은 뒤 \"이 초안으로 게시하기\" 로 바로 발행할 수 있어요."
              : "초안을 복사해서 Facebook 페이지에서 직접 게시해주세요."}
          </p>
        </div>

        <div className="px-[26px] py-4 flex flex-col gap-4">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[18px] h-[18px]" />
              <span className="font-medium text-[13px] text-[var(--w-fg-neutral)]">AI 가 초안을 만들고 있어요…</span>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="font-bold text-[15px] leading-[1.3] text-[var(--w-fg-strong)]">초안을 만들지 못했어요</div>
              <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)]">{error}</div>
              <Button variant="primary" size="sm" type="button" onClick={regenerate}>다시 시도</Button>
            </div>
          )}

          {status === "ready" && draft && (
            <>
              <DraftField
                label="캡션"
                value={draft.caption}
                onCopy={() => copy(draft.caption, "캡션")}
              />
              {isIg && draft.hashtags.length > 0 && (
                <DraftField
                  label="해시태그"
                  value={draft.hashtags.join(" ")}
                  onCopy={() => copy(draft.hashtags.join(" "), "해시태그")}
                />
              )}
              <DraftField
                label="이미지 프롬프트 (영어)"
                value={draft.imagePrompt}
                hint="Canva·Midjourney 등에 그대로 붙여넣으면 돼요"
                onCopy={() => copy(draft.imagePrompt, "이미지 프롬프트")}
              />
            </>
          )}
        </div>

        <div className="flex items-center gap-2 justify-between px-[26px] py-[18px] border-t border-[var(--w-line-alternative)] mt-2 flex-wrap">
          <span className="font-medium text-[12px] text-[var(--w-status-positive)] min-h-[16px]">{copyHint}</span>
          <div className="flex gap-2">
            {status === "ready" && (
              <>
                <Button variant="ghost" size="sm" type="button" onClick={regenerate}>다시 생성</Button>
                <Button variant="ghost" size="sm" type="button" onClick={() => copy(fullText, "전체")}>전체 복사</Button>
                {isIg && draft && (
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    onClick={() => {
                      const captionWithTags = draft.hashtags.length > 0
                        ? `${draft.caption}\n\n${draft.hashtags.join(" ")}`
                        : draft.caption;
                      router.push(`/instagram/posts?caption=${encodeURIComponent(captionWithTags)}`);
                    }}
                  >이 초안으로 게시하기</Button>
                )}
              </>
            )}
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>닫기</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DraftField({ label, value, hint, onCopy }: { label: string; value: string; hint?: string; onCopy: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-semibold text-[12px] text-[var(--w-fg-strong)]">{label}</span>
        <button
          type="button"
          onClick={onCopy}
          className="font-semibold text-[12px] text-[var(--w-primary-press)] bg-transparent border-0 cursor-pointer hover:underline"
        >복사</button>
      </div>
      <div className="font-medium text-[13px] leading-[1.55] text-[var(--w-fg-strong)] whitespace-pre-wrap rounded-[10px] border border-[var(--w-line-alternative)] bg-[var(--w-bg-alternative)] p-3">
        {value}
      </div>
      {hint && <div className="font-medium text-[11.5px] text-[var(--w-fg-neutral)] mt-1.5">{hint}</div>}
    </div>
  );
}
