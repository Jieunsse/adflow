"use client";

// 시안이 카피를 "실제 광고 모습 그대로" 보여주는 인스타그램 목업.
// compact = 3안 비교(1c) 의 카드 안, full = 다듬기(2b)·게재(1e) 의 좌측 미리보기.

import { cn } from "@shared/lib/cn";

const AVATAR = "linear-gradient(135deg, var(--w-green-500), var(--w-green-700))";

function Avatar({ size }: { size: number }) {
  return (
    <span
      className="rounded-full shrink-0"
      style={{ width: size, height: size, background: AVATAR }}
      aria-hidden
    />
  );
}

function Frame({ src, height, tag }: { src: string | null; height: number; tag?: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt="광고 이미지"
        style={{ width: "100%", height, objectFit: "cover", display: "block" }}
      />
    );
  }
  return (
    <div className="w-img-placeholder flex items-end p-3" style={{ height }}>
      {tag && (
        <span className="px-[9px] py-[5px] rounded-[var(--w-radius-6)] bg-[var(--w-surface-narrative)] text-[var(--w-on-narrative)] font-medium text-[11px] leading-[1.3]">
          {tag}
        </span>
      )}
    </div>
  );
}

export function AdMockCompact({
  handle,
  imageUrl,
  headline,
  body,
  className,
}: {
  handle: string;
  imageUrl: string | null;
  headline: string;
  body: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--w-radius-12)] overflow-hidden shadow-[inset_0_0_0_1px_var(--w-line-alternative)]",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Avatar size={26} />
        <span className="font-semibold text-[12px] leading-[1.3] text-[var(--w-fg-strong)] truncate">
          {handle}
        </span>
      </div>
      <Frame src={imageUrl} height={230} />
      <div className="px-3 pt-2.5 pb-3">
        <div className="font-bold text-[14px] leading-[1.45] text-[var(--w-fg-strong)] mb-1.5">
          {headline}
        </div>
        <div className="font-normal text-[12px] leading-[1.65] text-[var(--w-fg-normal)] line-clamp-5">
          {body}
        </div>
      </div>
    </div>
  );
}

export function AdMockFull({
  handle,
  imageUrl,
  imageTag,
  imageHeight = 330,
  headline,
  body,
  ctaLabel,
  className,
}: {
  handle: string;
  imageUrl: string | null;
  imageTag?: string | null;
  imageHeight?: number;
  headline: string;
  body: string;
  ctaLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden", className)}>
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <Avatar size={32} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[13px] leading-[1.3] text-[var(--w-fg-strong)] truncate">
            {handle}
          </div>
          <div className="font-normal text-[11px] leading-[1.3] text-[var(--w-fg-neutral)]">Sponsored</div>
        </div>
        <span className="text-[16px] text-[var(--w-fg-alternative)]" aria-hidden>
          ···
        </span>
      </div>

      <Frame src={imageUrl} height={imageHeight} tag={imageTag} />

      {ctaLabel && (
        <div className="flex items-center justify-between gap-3 px-3.5 py-3 border-t border-[var(--w-line-alternative)]">
          <span className="font-semibold text-[13px] leading-[1.4] text-[var(--w-fg-strong)] truncate">
            {headline}
          </span>
          <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)] shrink-0">
            {ctaLabel} ›
          </span>
        </div>
      )}

      <div className="px-3.5 pt-3 pb-4">
        {!ctaLabel && (
          <div className="font-semibold text-[13px] leading-[1.4] text-[var(--w-fg-strong)] mb-1.5">
            {headline}
          </div>
        )}
        <div className="font-normal text-[13px] leading-[1.7] text-[var(--w-fg-normal)] whitespace-pre-line">
          {ctaLabel && <b className="text-[var(--w-fg-strong)]">{handle} </b>}
          {body}
        </div>
      </div>
    </div>
  );
}
