"use client";

import { useState } from "react";
import { Button } from "@shared/ui/Button";
import { Select } from "@shared/ui/Select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@shared/ui/Dialog";
import type { Creator, CreatorPlatform } from "@entities/creator/model";

const PLATFORM_OPTIONS: { value: CreatorPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "other", label: "기타" },
];

const INPUT_CLASS =
  "w-full rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] px-3.5 py-3 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_var(--w-focus-ring)] transition-[border-color,box-shadow] duration-[120ms]";

const LABEL_CLASS = "font-semibold text-[13px] leading-none text-[var(--w-fg-strong)]";

function makeId(): string {
  return `creator_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function CreatorEditModal({
  creator,
  onClose,
  onSave,
}: {
  creator: Creator | null;
  onClose: () => void;
  onSave: (creator: Creator) => void;
}) {
  const isEdit = !!creator;
  const [handle, setHandle] = useState(creator?.handle ?? "");
  const [platform, setPlatform] = useState<CreatorPlatform>(creator?.platform ?? "instagram");
  const [displayName, setDisplayName] = useState(creator?.displayName ?? "");
  const [categoryText, setCategoryText] = useState(creator?.category.join(", ") ?? "");
  const [followerCount, setFollowerCount] = useState(
    creator?.followerCount != null ? String(creator.followerCount) : "",
  );
  const [note, setNote] = useState(creator?.note ?? "");

  const canSave = handle.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const category = categoryText
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const parsedFollower = followerCount.trim() ? Number(followerCount) : undefined;

    onSave({
      id: creator?.id ?? makeId(),
      handle: handle.trim(),
      platform,
      displayName: displayName.trim() || undefined,
      avatarUrl: creator?.avatarUrl,
      category,
      followerCount: parsedFollower != null && !Number.isNaN(parsedFollower) ? parsedFollower : undefined,
      note: note.trim() || undefined,
      performanceHistory: creator?.performanceHistory ?? [],
      createdAt: creator?.createdAt ?? new Date().toISOString(),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{ width: 480 }}>
        <div className="px-6 pt-6 pb-2">
          <DialogTitle className="m-0 font-bold text-[17px] leading-[1.35] tracking-[-0.01em] text-[var(--w-fg-strong)]">
            {isEdit ? "크리에이터 정보 수정" : "크리에이터 추가하기"}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-1.5 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">
              핸들·카테고리·팔로워 등 알고 있는 정보를 직접 입력해요.
            </div>
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-4 px-6 py-4">
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>핸들 *</label>
            <input
              className={INPUT_CLASS}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@handle"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>플랫폼</label>
            <Select
              value={platform}
              onChange={(v) => setPlatform(v as CreatorPlatform)}
              options={PLATFORM_OPTIONS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>이름</label>
            <input
              className={INPUT_CLASS}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="크리에이터 이름(선택)"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>카테고리</label>
            <input
              className={INPUT_CLASS}
              value={categoryText}
              onChange={(e) => setCategoryText(e.target.value)}
              placeholder="뷰티, 스킨케어 (쉼표로 구분)"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>팔로워 수</label>
            <input
              className={INPUT_CLASS}
              type="number"
              value={followerCount}
              onChange={(e) => setFollowerCount(e.target.value)}
              placeholder="직접 확인한 숫자를 입력해요"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>메모</label>
            <textarea
              className={INPUT_CLASS}
              style={{ minHeight: 80, resize: "vertical" }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="협업 시 참고할 메모를 남겨요"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end px-6 py-[18px] border-t border-[var(--w-line-alternative)]">
          <Button variant="ghost" type="button" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" type="button" onClick={handleSave} disabled={!canSave}>
            {isEdit ? "저장" : "추가하기"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
