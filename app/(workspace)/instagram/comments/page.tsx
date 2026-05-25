"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Icon from "@shared/ui/Icon";
import { IgPostPreview } from "@shared/ui/IgPostPreview";
import { useToast } from "@shared/ui/Toast";
import ConfirmModal from "@shared/ui/ConfirmModal";
import type { IgComment } from "@/lib/instagram-comments";

type MediaItem = {
  id: string;
  mediaUrl: string;
  caption: string;
  permalink?: string;
  timestamp: string;
  likeCount: number;
};

type MediaResp = { ok: true; items: MediaItem[] } | { ok: false; error: string };
type CommentsResp = { ok: true; items: IgComment[]; mock?: boolean; devFallback?: boolean } | { ok: false; error: string };
type RepliesResp = { ok: true; items: IgComment[]; mock?: boolean } | { ok: false; error: string };
type MutateResp = { ok: true; mock?: boolean } | { ok: false; error: string };
type CreateResp = { ok: true; id: string; mock?: boolean } | { ok: false; error: string };

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}시간 전`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}일 전`;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export default function CommentsPage() {
  const showToast = useToast();
  const { data: session } = useSession();

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [mediaErr, setMediaErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [comments, setComments] = useState<IgComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsErr, setCommentsErr] = useState<string | null>(null);
  const [commentsMock, setCommentsMock] = useState(false);
  const [commentsDevFallback, setCommentsDevFallback] = useState(false);

  const [replies, setReplies] = useState<Record<string, IgComment[]>>({});
  const [repliesOpen, setRepliesOpen] = useState<Record<string, boolean>>({});
  const [repliesLoading, setRepliesLoading] = useState<Record<string, boolean>>({});

  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replySubmitting, setReplySubmitting] = useState<Record<string, boolean>>({});

  const [newComment, setNewComment] = useState("");
  const [newSubmitting, setNewSubmitting] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<IgComment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [igPicture, setIgPicture] = useState<string | null>(null);

  const selectedMedia = media.find((m) => m.id === selectedId) ?? null;
  const commentsPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/connect/profile-pictures")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { igPicture?: string | null } | null) => {
        if (data?.igPicture) setIgPicture(data.igPicture);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    async function load() {
      setMediaLoading(true);
      setMediaErr(null);
      try {
        const res = await fetch("/api/instagram/recent-media?limit=20", { cache: "no-store" });
        const data = (await res.json()) as MediaResp;
        if (data.ok) {
          setMedia(data.items);
          if (data.items.length > 0) setSelectedId(data.items[0].id);
        } else {
          setMediaErr(data.error);
        }
      } catch (e) {
        setMediaErr(e instanceof Error ? e.message : "게시물 조회 실패");
      } finally {
        setMediaLoading(false);
      }
    }
    load();
  }, []);

  const loadComments = useCallback(async (mediaId: string) => {
    setCommentsLoading(true);
    setCommentsErr(null);
    setComments([]);
    setCommentsMock(false);
    setCommentsDevFallback(false);
    setReplies({});
    setRepliesOpen({});
    try {
      const res = await fetch(`/api/instagram/comments?mediaId=${encodeURIComponent(mediaId)}`, { cache: "no-store" });
      const data = (await res.json()) as CommentsResp;
      if (data.ok) {
        setComments(data.items);
        setCommentsMock(!!data.mock);
        setCommentsDevFallback(!!(data as { devFallback?: boolean }).devFallback);
      } else {
        setCommentsErr(data.error);
      }
    } catch (e) {
      setCommentsErr(e instanceof Error ? e.message : "댓글 조회 실패");
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadComments(selectedId);
  }, [selectedId, loadComments]);

  async function loadReplies(commentId: string) {
    setRepliesLoading((s) => ({ ...s, [commentId]: true }));
    try {
      const res = await fetch(`/api/instagram/comments/${encodeURIComponent(commentId)}/replies`, { cache: "no-store" });
      const data = (await res.json()) as RepliesResp;
      if (data.ok) setReplies((s) => ({ ...s, [commentId]: data.items }));
    } finally {
      setRepliesLoading((s) => ({ ...s, [commentId]: false }));
    }
  }

  function toggleReplies(commentId: string) {
    const next = !repliesOpen[commentId];
    setRepliesOpen((s) => ({ ...s, [commentId]: next }));
    if (next && !replies[commentId]) loadReplies(commentId);
  }

  async function handleHide(comment: IgComment) {
    const nextHidden = !comment.hidden;
    const res = await fetch(`/api/instagram/comments/${encodeURIComponent(comment.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: nextHidden }),
    });
    const data = (await res.json()) as MutateResp;
    if (data.ok) {
      setComments((cs) => cs.map((c) => c.id === comment.id ? { ...c, hidden: nextHidden } : c));
      showToast(nextHidden ? "댓글을 숨겼어요." : "댓글을 다시 표시해요.");
    } else {
      showToast(data.error);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || !selectedId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/instagram/comments/${encodeURIComponent(pendingDelete.id)}`, { method: "DELETE" });
      const data = (await res.json()) as MutateResp;
      if (data.ok) {
        setComments((cs) => cs.filter((c) => c.id !== pendingDelete.id));
        setPendingDelete(null);
        showToast("댓글을 삭제했어요.");
      } else {
        showToast(data.error);
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleReply(commentId: string) {
    const message = replyDraft[commentId]?.trim();
    if (!message) return;
    setReplySubmitting((s) => ({ ...s, [commentId]: true }));
    try {
      const res = await fetch(`/api/instagram/comments/${encodeURIComponent(commentId)}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json()) as CreateResp;
      if (data.ok) {
        setReplyDraft((s) => ({ ...s, [commentId]: "" }));
        const newReply: IgComment = {
          id: data.id,
          username: session?.igUsername ?? "me",
          text: message,
          timestamp: new Date().toISOString(),
          likeCount: 0,
          hidden: false,
          replyCount: 0,
        };
        setReplies((s) => ({ ...s, [commentId]: [...(s[commentId] ?? []), newReply] }));
        setRepliesOpen((s) => ({ ...s, [commentId]: true }));
        if (data.mock) showToast("샘플 모드 — 실제 IG에는 게시되지 않아요.");
        else showToast("답글을 게시했어요.");
      } else {
        showToast(data.error);
      }
    } finally {
      setReplySubmitting((s) => ({ ...s, [commentId]: false }));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !newComment.trim()) return;
    setNewSubmitting(true);
    try {
      const res = await fetch("/api/instagram/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: selectedId, message: newComment.trim() }),
      });
      const data = (await res.json()) as CreateResp;
      if (data.ok) {
        const created: IgComment = {
          id: data.id,
          username: session?.igUsername ?? "me",
          text: newComment.trim(),
          timestamp: new Date().toISOString(),
          likeCount: 0,
          hidden: false,
          replyCount: 0,
        };
        setComments((cs) => [created, ...cs]);
        setNewComment("");
        if (data.mock) showToast("샘플 모드 — 실제 IG에는 게시되지 않아요.");
        else showToast("댓글을 게시했어요.");
        setTimeout(() => commentsPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
      } else {
        showToast(data.error);
      }
    } finally {
      setNewSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 좌: 게시물 목록 (1) */}
      <aside className="flex-1 min-w-0 border-r border-[var(--w-line-normal)] flex flex-col bg-[var(--w-bg-elevated)] overflow-hidden">
        <div className="px-4 py-4 border-b border-[var(--w-line-alternative)]">
          <h1 className="font-bold text-[15px] text-[var(--w-fg-strong)] leading-none">댓글 관리</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {mediaLoading ? (
            <div className="text-[12.5px] text-[var(--w-fg-alternative)] py-10 text-center">불러오는 중…</div>
          ) : mediaErr ? (
            <div className="text-[12.5px] text-[var(--w-fg-alternative)] py-10 text-center leading-[1.5]">{mediaErr}</div>
          ) : media.length === 0 ? (
            <div className="text-[12.5px] text-[var(--w-fg-alternative)] py-10 text-center">게시물이 없어요.</div>
          ) : (
            <ul>
              {media.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full flex gap-3 px-4 py-3 text-left transition-colors duration-100 border-b border-[var(--w-line-alternative)] ${
                      selectedId === item.id
                        ? "bg-[var(--w-primary-soft)]"
                        : "hover:bg-[var(--w-bg-neutral)]"
                    }`}
                  >
                    {item.mediaUrl ? (
                      <Image
                        src={item.mediaUrl}
                        alt=""
                        width={44}
                        height={44}
                        className="w-11 h-11 rounded-lg object-cover bg-[var(--w-bg-neutral)] shrink-0"
                        unoptimized
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-[var(--w-bg-neutral)] shrink-0 grid place-items-center">
                        <Icon name="image" size={16} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] text-[var(--w-fg-strong)] leading-[1.4] line-clamp-2">
                        {item.caption || <span className="text-[var(--w-fg-alternative)]">(캡션 없음)</span>}
                      </div>
                      <div className="text-[11px] text-[var(--w-fg-alternative)] mt-1">
                        {formatDate(item.timestamp)}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

        {/* 중: 댓글 패널 (2) */}
        <div className="flex-[2] min-w-0 flex flex-col bg-[var(--w-bg-alternative)] overflow-hidden border-x border-[var(--w-line-normal)]">
          {!selectedMedia ? null : (
            <>
              {/* 헤더 */}
              <div className="px-5 py-3 border-b border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] flex items-center gap-3 shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--w-fg-strong)] leading-none">댓글</div>
                  <div className="text-[11px] text-[var(--w-fg-alternative)] mt-0.5">
                    {formatDate(selectedMedia.timestamp)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => loadComments(selectedMedia.id)}
                  className="text-[11.5px] font-semibold text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] flex items-center gap-1 shrink-0"
                  disabled={commentsLoading}
                >
                  <Icon name="refresh" size={11} spin={commentsLoading} />
                </button>
              </div>

              {/* 댓글 목록 */}
              <div ref={commentsPanelRef} className="flex-1 overflow-y-auto px-5 py-4">
                {commentsLoading ? (
                  <div className="text-[12.5px] text-[var(--w-fg-alternative)] py-10 text-center">댓글 불러오는 중…</div>
                ) : commentsErr ? (
                  <div className="text-[12.5px] text-[var(--w-status-negative)] py-10 text-center leading-[1.5]">{commentsErr}</div>
                ) : comments.length === 0 ? (
                  <div className="text-[12.5px] text-[var(--w-fg-alternative)] py-10 text-center">아직 댓글이 없어요.</div>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {commentsDevFallback && (
                      <li className="text-[11px] text-[var(--w-fg-alternative)] mb-2 px-1">
                        앱 심사 전 개발 환경 — 샘플 댓글을 표시해요.
                      </li>
                    )}
                    {commentsMock && !commentsDevFallback && (
                      <li className="text-[11px] text-[var(--w-fg-alternative)] mb-2 px-1">
                        연결된 IG 계정이 없어 샘플 데이터를 보여줘요.
                      </li>
                    )}
                    {comments.map((c) => (
                      <CommentRow
                        key={c.id}
                        comment={c}
                        replies={replies[c.id]}
                        repliesOpen={!!repliesOpen[c.id]}
                        repliesLoading={!!repliesLoading[c.id]}
                        replyDraft={replyDraft[c.id] ?? ""}
                        replySubmitting={!!replySubmitting[c.id]}
                        onToggleReplies={() => toggleReplies(c.id)}
                        onHide={() => handleHide(c)}
                        onDelete={() => setPendingDelete(c)}
                        onReplyDraft={(v) => setReplyDraft((s) => ({ ...s, [c.id]: v }))}
                        onReplySubmit={() => handleReply(c.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>

              {/* 새 댓글 작성 */}
              <div className="border-t border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] px-5 py-3 shrink-0">
                <form onSubmit={handleCreate} className="flex gap-2 items-center">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="이 게시물에 댓글 달기…"
                    rows={2}
                    maxLength={2200}
                    className="flex-1 px-3 py-2 rounded-[10px] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[13px] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] resize-none leading-[1.5]"
                    disabled={newSubmitting}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCreate(e as unknown as React.FormEvent);
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!newComment.trim() || newSubmitting}
                    className="shrink-0 h-9 px-4 rounded-[10px] bg-[var(--w-primary-normal)] text-white font-semibold text-[12.5px] disabled:opacity-40 hover:bg-[var(--w-primary-press)] transition-colors"
                  >
                    {newSubmitting ? "게시 중…" : "게시"}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>

        {/* 우: IG 포스트 미리보기 (1) */}
        <div className="flex-1 min-w-0 bg-[var(--w-bg-alternative)] overflow-y-auto flex flex-col items-center py-8 px-6">
          {!selectedMedia ? (
            <div className="flex-1 grid place-items-center text-[13px] text-[var(--w-fg-alternative)] w-full h-full">
              게시물을 선택하세요
            </div>
          ) : (
            <>
              <div className="text-[10.5px] font-semibold tracking-wide uppercase text-[var(--w-fg-alternative)] mb-2 w-full">
                미리보기
              </div>
              <IgPostPreview
                imageUrl={selectedMedia.mediaUrl}
                caption={selectedMedia.caption}
                handle={session?.igUsername ?? "instagram"}
                profilePicture={igPicture}
                timestamp={formatDate(selectedMedia.timestamp)}
                likeCount={selectedMedia.likeCount}
                className="w-full"
              />
              {selectedMedia.permalink && (
                <a
                  href={selectedMedia.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full flex items-center justify-center gap-2 h-10 rounded-[10px] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[13px] font-semibold text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)] transition-colors"
                >
                  <Icon name="link" size={13} />
                  Instagram에서 열기
                </a>
              )}
            </>
          )}
        </div>

      {pendingDelete && (
        <ConfirmModal
          title="이 댓글을 삭제할까요?"
          desc={
            <div className="flex flex-col gap-1.5">
              <span>@{pendingDelete.username} 의 댓글이 영구 삭제돼요. 되돌릴 수 없어요.</span>
              <span className="text-[12px] text-[var(--w-fg-alternative)] line-clamp-3">"{pendingDelete.text}"</span>
            </div>
          }
          confirmLabel={deleting ? "삭제 중…" : "삭제"}
          tone="danger"
          onClose={() => { if (!deleting) setPendingDelete(null); }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function CommentRow({
  comment,
  replies,
  repliesOpen,
  repliesLoading,
  replyDraft,
  replySubmitting,
  onToggleReplies,
  onHide,
  onDelete,
  onReplyDraft,
  onReplySubmit,
}: {
  comment: IgComment;
  replies?: IgComment[];
  repliesOpen: boolean;
  repliesLoading: boolean;
  replyDraft: string;
  replySubmitting: boolean;
  onToggleReplies: () => void;
  onHide: () => void;
  onDelete: () => void;
  onReplyDraft: (v: string) => void;
  onReplySubmit: () => void;
}) {
  const [showReplyInput, setShowReplyInput] = useState(false);

  return (
    <li className={`rounded-xl px-3.5 py-3 ${comment.hidden ? "bg-[var(--w-bg-neutral)] opacity-60" : "bg-[var(--w-bg-elevated)]"}`}>
      <div className="flex gap-2.5 items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[12.5px] text-[var(--w-fg-strong)]">@{comment.username}</span>
            <span className="text-[11px] text-[var(--w-fg-alternative)]">{formatDate(comment.timestamp)}</span>
            {comment.likeCount > 0 && (
              <span className="text-[11px] text-[var(--w-fg-alternative)] inline-flex items-center gap-0.5">
                <Icon name="heart" size={10} />{comment.likeCount}
              </span>
            )}
            {comment.hidden && (
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[var(--w-bg-neutral)] text-[var(--w-fg-alternative)]">
                숨김
              </span>
            )}
          </div>
          <p className="text-[13px] text-[var(--w-fg-strong)] leading-[1.5] mt-1 break-words whitespace-pre-wrap">
            {comment.text}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={() => { setShowReplyInput((v) => !v); }}
              className="text-[11.5px] font-semibold text-[var(--w-primary-normal)] hover:underline"
            >
              답글
            </button>
            {comment.replyCount > 0 && (
              <button
                type="button"
                onClick={onToggleReplies}
                className="text-[11.5px] font-semibold text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] flex items-center gap-1"
              >
                {repliesLoading ? (
                  <Icon name="spinner" size={11} spin />
                ) : repliesOpen ? (
                  `답글 ${comment.replyCount}개 접기`
                ) : (
                  `답글 ${comment.replyCount}개 보기`
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onHide}
              className="text-[11.5px] font-semibold text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]"
            >
              {comment.hidden ? "보이기" : "숨기기"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-[11.5px] font-semibold text-[var(--w-status-negative)] hover:underline"
            >
              삭제
            </button>
          </div>
        </div>
      </div>

      {repliesOpen && replies && replies.length > 0 && (
        <ul className="mt-2.5 ml-4 flex flex-col gap-2 border-l-2 border-[var(--w-line-alternative)] pl-3">
          {replies.map((r) => (
            <li key={r.id} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[12px] text-[var(--w-fg-strong)]">@{r.username}</span>
                <span className="text-[10.5px] text-[var(--w-fg-alternative)]">{formatDate(r.timestamp)}</span>
              </div>
              <p className="text-[12.5px] text-[var(--w-fg-strong)] leading-[1.45] break-words whitespace-pre-wrap">
                {r.text}
              </p>
            </li>
          ))}
        </ul>
      )}

      {showReplyInput && (
        <div className="mt-2.5 ml-4 flex gap-2 items-end">
          <input
            type="text"
            value={replyDraft}
            onChange={(e) => onReplyDraft(e.target.value)}
            placeholder={`@${comment.username} 에게 답글…`}
            maxLength={2200}
            className="flex-1 px-3 py-2 rounded-[8px] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[12.5px] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)]"
            disabled={replySubmitting}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onReplySubmit(); }
            }}
          />
          <button
            type="button"
            onClick={onReplySubmit}
            disabled={!replyDraft.trim() || replySubmitting}
            className="h-9 px-3.5 rounded-[8px] bg-[var(--w-primary-normal)] text-white font-semibold text-[12px] disabled:opacity-40 hover:bg-[var(--w-primary-press)] transition-colors shrink-0"
          >
            {replySubmitting ? <Icon name="spinner" size={13} spin /> : <Icon name="send" size={13} />}
          </button>
        </div>
      )}
    </li>
  );
}
