import type { ReactNode } from "react";
import Image from "next/image";
import Icon from "./Icon";

type CaptionToken = { type: "text" | "tag" | "mention"; value: string };

function tokenizeCaption(s: string): CaptionToken[] {
  const re = /(#[^\s#@]+|@[^\s#@]+)/g;
  const out: CaptionToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last)
      out.push({ type: "text", value: s.slice(last, m.index) });
    out.push({ type: m[0][0] === "#" ? "tag" : "mention", value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ type: "text", value: s.slice(last) });
  return out;
}

export function IgPostPreview({
  imageUrl,
  caption,
  handle,
  profilePicture,
  broken,
  timestamp,
  likeCount,
  headline,
  sponsored,
  ctaLabel = "더 알아보기",
  className,
  overlay,
}: {
  imageUrl: string;
  caption: string;
  handle: string;
  profilePicture?: string | null;
  broken?: boolean;
  timestamp?: string;
  likeCount?: number;
  headline?: string;
  sponsored?: boolean;
  ctaLabel?: string;
  className?: string;
  // 텍스트 편집 — 정사각 이미지 영역 위에 절대배치되는 레이어(드래그 surface 등). 미전달 시 기존 동작.
  overlay?: ReactNode;
}) {
  const tokens = tokenizeCaption(caption);
  const showImage = imageUrl && !broken;

  return (
    <div
      className={`rounded-[14px] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] overflow-hidden${className ? ` ${className}` : ""}`}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#feda75] via-[#fa7e1e] to-[#d62976] p-[2px] shrink-0">
          <div className="w-full h-full rounded-full bg-[var(--w-bg-elevated)] overflow-hidden grid place-items-center">
            {profilePicture ? (
              <Image
                src={profilePicture}
                alt=""
                width={30}
                height={30}
                className="w-full h-full object-cover rounded-full"
                unoptimized
              />
            ) : (
              <span className="text-[10px] font-bold text-[var(--w-fg-strong)]">
                {handle[0].toUpperCase()}
              </span>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-[var(--w-fg-strong)] truncate">
            {handle}
          </div>
          {sponsored && (
            <div className="text-[11px] text-[var(--w-fg-alternative)] leading-[1.3]">
              Sponsored
            </div>
          )}
        </div>
        <Icon name="dots" size={16} />
      </div>

      <div className="aspect-square bg-[var(--w-bg-neutral)] relative overflow-hidden">
        {showImage ? (
          <>
            <Image
              src={imageUrl}
              alt=""
              fill
              className="object-cover scale-110 blur-xl opacity-60"
              unoptimized
              sizes="360px"
              aria-hidden
            />
            <Image
              src={imageUrl}
              alt=""
              fill
              className="object-contain"
              unoptimized
              sizes="360px"
            />
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[var(--w-fg-alternative)]">
            <div className="text-center">
              <Icon name="image" size={28} />
              <div className="text-[11.5px] mt-1.5 leading-[1.4] max-w-[220px]">
                이미지를 추가하면 여기에 미리보기가 나타나요
              </div>
            </div>
          </div>
        )}
        {overlay}
      </div>

      {headline && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--w-bg-neutral)] border-t border-[var(--w-line-normal)]">
          <div className="min-w-0 flex-1 text-[12.5px] font-semibold text-[var(--w-fg-strong)] leading-[1.35] truncate">
            {headline}
          </div>
          <span className="shrink-0 inline-flex items-center gap-0.5 text-[12px] font-semibold text-[var(--w-fg-neutral)]">
            {ctaLabel}
            <Icon name="arrow-right" size={13} />
          </span>
        </div>
      )}

      <div className="flex items-center px-3 pt-2.5 pb-1.5 text-[var(--w-fg-strong)]">
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="p-1 -ml-1"
          disabled
        >
          <HeartGlyph />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="p-1"
          disabled
        >
          <CommentGlyph />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="p-1"
          disabled
        >
          <SendGlyph />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="p-1 -mr-1"
          disabled
        >
          <BookmarkGlyph />
        </button>
      </div>

      <div className="px-3 text-[12.5px] font-semibold text-[var(--w-fg-strong)]">
        좋아요 {likeCount ?? 0}개
      </div>

      <div className="px-3 pt-1 pb-2 text-[12.5px] text-[var(--w-fg-strong)] leading-[1.5] break-words">
        {caption ? (
          <>
            <span className="font-semibold mr-1.5">{handle}</span>
            {tokens.map((t, i) =>
              t.type === "text" ? (
                <span key={i} style={{ whiteSpace: "pre-wrap" }}>
                  {t.value}
                </span>
              ) : (
                <span key={i} className="text-[#1d6fb8]">
                  {t.value}
                </span>
              ),
            )}
          </>
        ) : (
          <span className="text-[var(--w-fg-alternative)]">
            캡션을 입력하면 여기에 미리보기가 나타나요
          </span>
        )}
      </div>

      {!sponsored && (
        <div className="px-3 pb-3 text-[10px] uppercase tracking-wide text-[var(--w-fg-alternative)]">
          {timestamp ?? "방금 전"}
        </div>
      )}
    </div>
  );
}

function HeartGlyph() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentGlyph() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function SendGlyph() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function BookmarkGlyph() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
