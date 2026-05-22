"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { useToast } from "@shared/ui/Toast";
import ConfirmModal from "@shared/ui/ConfirmModal";
import type { IgComment } from "@/lib/instagram-comments";

type RecentItem = {
  id: string;
  mediaUrl: string;
  caption: string;
  permalink?: string;
  timestamp: string;
};

type PublishOk = { ok: true; postId: string; permalink?: string };
type PublishFail = { ok: false; error: string; status?: number };
type PublishResp = PublishOk | PublishFail;

type RecentResp =
  | { ok: true; items: RecentItem[] }
  | { ok: false; error: string };

type CommentsResp =
  | { ok: true; items: IgComment[]; mock?: boolean }
  | { ok: false; error: string };

type DeleteCommentResp = { ok: true; mock?: boolean } | { ok: false; error: string };

type UploadResp = { ok: true; url: string } | { ok: false; error: string };

const SAMPLES = [
  "https://picsum.photos/seed/adflow-feed-1/1080/1080",
  "https://picsum.photos/seed/adflow-feed-2/1080/1080",
  "https://picsum.photos/seed/adflow-feed-3/1080/1080",
  "https://picsum.photos/seed/adflow-feed-4/1080/1080",
];

const HANDLE = "adflow_brand";

function isHttpUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim());
}

type CaptionToken = { type: "text" | "tag" | "mention"; value: string };

function tokenizeCaption(s: string): CaptionToken[] {
  const re = /(#[^\s#@]+|@[^\s#@]+)/g;
  const out: CaptionToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ type: "text", value: s.slice(last, m.index) });
    out.push({ type: m[0][0] === "#" ? "tag" : "mention", value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ type: "text", value: s.slice(last) });
  return out;
}

export default function PostsPage() {
  const showToast = useToast();
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<PublishResp | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [recentErr, setRecentErr] = useState<string | null>(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const [openMediaId, setOpenMediaId] = useState<string | null>(null);
  const [commentsByMedia, setCommentsByMedia] = useState<Record<string, IgComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentsErr, setCommentsErr] = useState<Record<string, string | null>>({});
  const [commentsMock, setCommentsMock] = useState<Record<string, boolean>>({});
  const [pendingDelete, setPendingDelete] = useState<{ mediaId: string; comment: IgComment } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      const res = await fetch("/api/instagram/recent-media", { cache: "no-store" });
      const data = (await res.json()) as RecentResp;
      if (data.ok) {
        setRecent(data.items);
        setRecentErr(null);
      } else {
        setRecent([]);
        setRecentErr(data.error);
      }
    } catch (e) {
      setRecentErr(e instanceof Error ? e.message : "최근 게시 조회 실패");
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    setPreviewBroken(false);
  }, [imageUrl]);

  const loadComments = useCallback(async (mediaId: string) => {
    setCommentsLoading((s) => ({ ...s, [mediaId]: true }));
    setCommentsErr((s) => ({ ...s, [mediaId]: null }));
    try {
      const res = await fetch(`/api/instagram/comments?mediaId=${encodeURIComponent(mediaId)}`, { cache: "no-store" });
      const data = (await res.json()) as CommentsResp;
      if (data.ok) {
        setCommentsByMedia((s) => ({ ...s, [mediaId]: data.items }));
        setCommentsMock((s) => ({ ...s, [mediaId]: !!data.mock }));
      } else {
        setCommentsErr((s) => ({ ...s, [mediaId]: data.error }));
      }
    } catch (e) {
      setCommentsErr((s) => ({ ...s, [mediaId]: e instanceof Error ? e.message : "댓글 조회 실패" }));
    } finally {
      setCommentsLoading((s) => ({ ...s, [mediaId]: false }));
    }
  }, []);

  const togglePanel = useCallback((mediaId: string) => {
    setOpenMediaId((prev) => {
      const next = prev === mediaId ? null : mediaId;
      if (next && !commentsByMedia[next]) loadComments(next);
      return next;
    });
  }, [commentsByMedia, loadComments]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { mediaId, comment } = pendingDelete;
    try {
      const res = await fetch(`/api/instagram/comments/${encodeURIComponent(comment.id)}`, { method: "DELETE" });
      const data = (await res.json()) as DeleteCommentResp;
      if (data.ok) {
        setCommentsByMedia((s) => ({
          ...s,
          [mediaId]: (s[mediaId] ?? []).filter((c) => c.id !== comment.id),
        }));
        showToast(data.mock ? "댓글 삭제 (mock)" : "댓글이 삭제됐어요");
      } else {
        showToast(`삭제 실패 — ${data.error}`);
      }
    } catch (e) {
      showToast(`삭제 실패 — ${e instanceof Error ? e.message : "요청 실패"}`);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }, [pendingDelete, showToast]);

  const canSubmit = imageUrl.trim().length > 0 && !submitting && !uploading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/instagram/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: imageUrl.trim(), caption: caption.trim() }),
      });
      const data = (await res.json()) as PublishResp;
      setLastResult(data);
      if (data.ok) {
        showToast("Instagram 게시 완료");
        setImageUrl("");
        setCaption("");
        loadRecent();
      } else {
        showToast(`게시 실패 — ${data.error}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "요청 실패";
      setLastResult({ ok: false, error: msg });
      showToast(`게시 실패 — ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("이미지 파일만 선택할 수 있어요");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/instagram/upload", { method: "POST", body: fd });
      const data = (await res.json()) as UploadResp;
      if (data.ok) {
        setImageUrl(data.url);
      } else {
        showToast(`업로드 실패 — ${data.error}`);
      }
    } catch (e) {
      showToast(`업로드 실패 — ${e instanceof Error ? e.message : "요청 실패"}`);
    } finally {
      setUploading(false);
    }
  }, [showToast]);

  const openFilePicker = () => {
    if (submitting || uploading) return;
    fileInputRef.current?.click();
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
      return;
    }
    const raw = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    const candidate = raw.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#")) ?? "";
    if (isHttpUrl(candidate)) {
      setImageUrl(candidate);
    } else {
      showToast("이미지 URL 을 인식하지 못했어요");
    }
  };

  const onPasteZone = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").trim();
    if (isHttpUrl(text)) {
      e.preventDefault();
      setImageUrl(text);
    }
  };

  return (
    <div className="px-10 py-9 max-w-[1180px]">
      <header className="mb-6 flex items-start justify-between gap-6">
        <div>
          <h1 className="font-bold text-[24px] leading-tight tracking-[-0.02em] text-[var(--w-fg-strong)]">
            새 게시물
          </h1>
          <p className="text-[13.5px] leading-[1.55] text-[var(--w-fg-neutral)] mt-1.5">
            Instagram 비즈니스 계정에 사진과 캡션을 게시해요. 오른쪽 미리보기는 실제 피드와 같은 모양으로 보여줍니다.
          </p>
        </div>
        <Button form="ig-publish" type="submit" variant="primary" size="md" disabled={!canSubmit}>
          {submitting ? (
            <>
              <Icon name="clock" size={14} />
              게시 중...
            </>
          ) : (
            <>
              <Icon name="sparkles" size={14} />
              게시
            </>
          )}
        </Button>
      </header>

      <Card variant="lg">
        <form id="ig-publish" onSubmit={onSubmit} className="grid grid-cols-[1fr_360px] gap-8 items-start">
          <div className="flex flex-col gap-5 min-w-0">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onPaste={onPasteZone}
              onClick={openFilePicker}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFilePicker(); } }}
              role="button"
              aria-label="이미지 파일 선택"
              tabIndex={0}
              className={`relative rounded-[14px] border-2 border-dashed outline-none transition-colors cursor-pointer ${
                dragOver
                  ? "border-[var(--w-primary-normal)] bg-[var(--w-primary-pale,rgba(99,93,255,0.06))]"
                  : "border-[var(--w-line-normal)] bg-[var(--w-bg-base)] hover:border-[var(--w-line-strong)] focus:border-[var(--w-primary-normal)]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onFileInputChange}
                className="hidden"
              />
              {imageUrl ? (
                <div className="flex items-start gap-4 p-4">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-[var(--w-bg-neutral)] shrink-0">
                    {!previewBroken ? (
                      <Image
                        src={imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                        onError={() => setPreviewBroken(true)}
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-[var(--w-fg-alternative)]">
                        <Icon name="warn" size={20} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-[var(--w-fg-strong)] mb-1">
                      이미지 선택됨
                      {previewBroken && (
                        <span className="ml-2 text-[11px] font-normal text-[var(--w-status-negative)]">미리보기 로드 실패 — URL 을 확인해 주세요</span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-[var(--w-fg-alternative)] break-all line-clamp-2">{imageUrl}</div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setImageUrl(""); }}
                      className="mt-2 text-[11.5px] font-semibold text-[var(--w-fg-neutral)] hover:text-[var(--w-status-negative)]"
                      disabled={submitting}
                    >
                      제거
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid place-items-center text-center py-10 px-4">
                  <Icon name="image" size={28} />
                  <div className="text-[13.5px] font-semibold text-[var(--w-fg-strong)] mt-2">
                    {uploading ? "업로드 중..." : "클릭해서 파일을 고르거나 이미지 URL 을 드래그/붙여넣기"}
                  </div>
                  <div className="text-[11.5px] text-[var(--w-fg-alternative)] mt-1 leading-[1.5] max-w-[360px]">
                    JPG · PNG · WebP, 최대 8MB. 업로드한 파일은 공개 URL 로 호스팅돼 Instagram 이 가져갑니다.
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="imageUrl" className="text-[11.5px] font-semibold text-[var(--w-fg-neutral)]">
                또는 이미지 URL 직접 입력
              </label>
              <input
                id="imageUrl"
                type="url"
                placeholder="https://example.com/photo.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="h-10 px-3.5 rounded-[10px] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[13px] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)]"
                disabled={submitting}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[11.5px] font-semibold text-[var(--w-fg-neutral)]">샘플 이미지</span>
              <div className="grid grid-cols-4 gap-2">
                {SAMPLES.map((url) => {
                  const selected = imageUrl === url;
                  return (
                    <button
                      type="button"
                      key={url}
                      onClick={() => setImageUrl(url)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${
                        selected
                          ? "border-[var(--w-primary-normal)]"
                          : "border-transparent hover:border-[var(--w-line-normal)]"
                      }`}
                      aria-pressed={selected}
                      aria-label="샘플 선택"
                    >
                      <Image src={url} alt="" fill className="object-cover" unoptimized sizes="80px" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="caption" className="text-[11.5px] font-semibold text-[var(--w-fg-neutral)]">
                캡션
              </label>
              <textarea
                id="caption"
                placeholder="게시글 본문, 해시태그(#), @멘션을 자유롭게 적어 주세요"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={6}
                maxLength={2200}
                className="px-3.5 py-3 rounded-[10px] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[13.5px] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] resize-y leading-[1.55]"
                disabled={submitting}
              />
              <div className="text-[11.5px] text-[var(--w-fg-alternative)] self-end">{caption.length} / 2200</div>
            </div>

            {lastResult?.ok && lastResult.permalink && (
              <a
                href={lastResult.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12.5px] font-semibold text-[var(--w-primary-normal)] hover:underline"
              >
                방금 게시한 글 보기 →
              </a>
            )}
            {lastResult && !lastResult.ok && (
              <div className="rounded-lg border border-[var(--w-status-negative)] bg-[rgba(232,72,72,0.06)] px-3.5 py-3 text-[12.5px] text-[var(--w-status-negative)] leading-[1.5]">
                <span className="font-semibold">게시 실패 — </span>
                {lastResult.error}
              </div>
            )}
          </div>

          <FeedPreview imageUrl={imageUrl} caption={caption} handle={HANDLE} broken={previewBroken} />
        </form>
      </Card>

      <Card variant="default" className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[14px] text-[var(--w-fg-strong)]">최근 게시</h2>
          <button
            type="button"
            onClick={loadRecent}
            className="text-[11.5px] font-semibold text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] inline-flex items-center gap-1"
            disabled={recentLoading}
          >
            <Icon name="refresh" size={11} />
            새로고침
          </button>
        </div>
        {recentLoading ? (
          <div className="text-[12.5px] text-[var(--w-fg-alternative)] py-8 text-center">불러오는 중…</div>
        ) : recentErr ? (
          <div className="text-[12.5px] text-[var(--w-fg-alternative)] py-8 text-center leading-[1.55]">{recentErr}</div>
        ) : recent.length === 0 ? (
          <div className="text-[12.5px] text-[var(--w-fg-alternative)] py-8 text-center">아직 게시물이 없어요.</div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            {recent.map((item) => {
              const isOpen = openMediaId === item.id;
              const comments = commentsByMedia[item.id] ?? [];
              const loading = commentsLoading[item.id] ?? false;
              const err = commentsErr[item.id] ?? null;
              const mock = commentsMock[item.id] ?? false;
              return (
                <li key={item.id} className="flex flex-col">
                  <div className="flex gap-3 items-start">
                    {item.mediaUrl ? (
                      <Image
                        src={item.mediaUrl}
                        alt=""
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-lg object-cover bg-[var(--w-bg-neutral)] shrink-0"
                        unoptimized
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-[var(--w-bg-neutral)] shrink-0 grid place-items-center">
                        <Icon name="image" size={18} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] text-[var(--w-fg-strong)] leading-[1.4] line-clamp-2">
                        {item.caption || <span className="text-[var(--w-fg-alternative)]">(캡션 없음)</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--w-fg-alternative)]">
                        <span>{formatDate(item.timestamp)}</span>
                        {item.permalink && (
                          <a
                            href={item.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[var(--w-primary-normal)] hover:underline"
                          >
                            열기
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => togglePanel(item.id)}
                          className="font-semibold text-[var(--w-primary-normal)] hover:underline inline-flex items-center gap-1"
                        >
                          <Icon name="message" size={11} />
                          {isOpen ? "댓글 접기" : "댓글 관리"}
                        </button>
                      </div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-2.5 ml-[68px] rounded-lg border border-[var(--w-line-alternative)] bg-[var(--w-bg-base)] p-3">
                      {loading ? (
                        <div className="text-[11.5px] text-[var(--w-fg-alternative)] py-3 text-center">댓글 불러오는 중…</div>
                      ) : err ? (
                        <div className="text-[11.5px] text-[var(--w-status-negative)] py-3 text-center leading-[1.55]">{err}</div>
                      ) : comments.length === 0 ? (
                        <div className="text-[11.5px] text-[var(--w-fg-alternative)] py-3 text-center">아직 댓글이 없어요.</div>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {mock && (
                            <li className="text-[10.5px] text-[var(--w-fg-alternative)] mb-1">
                              연결된 IG 계정이 없어 샘플 데이터를 보여줘요.
                            </li>
                          )}
                          {comments.map((c) => (
                            <li key={c.id} className="flex gap-2 items-start">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 text-[11.5px]">
                                  <span className="font-semibold text-[var(--w-fg-strong)]">@{c.username}</span>
                                  <span className="text-[var(--w-fg-alternative)]">{formatDate(c.timestamp)}</span>
                                  {c.likeCount > 0 && (
                                    <span className="text-[var(--w-fg-alternative)] inline-flex items-center gap-0.5">
                                      <Icon name="heart" size={10} />{c.likeCount}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[12px] text-[var(--w-fg-strong)] leading-[1.45] mt-0.5 break-words">
                                  {c.text}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setPendingDelete({ mediaId: item.id, comment: c })}
                                className="shrink-0 text-[11px] font-semibold text-[var(--w-status-negative)] hover:underline px-1.5 py-0.5"
                                aria-label={`@${c.username} 댓글 삭제`}
                              >
                                삭제
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {pendingDelete && (
        <ConfirmModal
          title="이 댓글을 삭제할까요?"
          desc={
            <div className="flex flex-col gap-1.5">
              <span>@{pendingDelete.comment.username} 의 댓글이 영구 삭제돼요. 되돌릴 수 없어요.</span>
              <span className="text-[12px] text-[var(--w-fg-alternative)] line-clamp-3">“{pendingDelete.comment.text}”</span>
            </div>
          }
          confirmLabel={deleting ? "삭제 중..." : "삭제"}
          tone="danger"
          onClose={() => { if (!deleting) setPendingDelete(null); }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function FeedPreview({
  imageUrl,
  caption,
  handle,
  broken,
}: {
  imageUrl: string;
  caption: string;
  handle: string;
  broken: boolean;
}) {
  const tokens = tokenizeCaption(caption);
  const showImage = imageUrl && !broken;

  return (
    <div className="sticky top-6">
      <div className="text-[10.5px] font-semibold tracking-wide uppercase text-[var(--w-fg-alternative)] mb-2">
        미리보기
      </div>
      <div className="rounded-[14px] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] overflow-hidden">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#feda75] via-[#fa7e1e] to-[#d62976] p-[2px] shrink-0">
            <div className="w-full h-full rounded-full bg-[var(--w-bg-elevated)] grid place-items-center">
              <span className="text-[10px] font-bold text-[var(--w-fg-strong)]">{handle[0].toUpperCase()}</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold text-[var(--w-fg-strong)] truncate">{handle}</div>
          </div>
          <Icon name="dots" size={16} />
        </div>

        <div className="aspect-square bg-[var(--w-bg-neutral)] relative">
          {showImage ? (
            <Image src={imageUrl} alt="" fill className="object-cover" unoptimized sizes="360px" />
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
        </div>

        <div className="flex items-center px-3 pt-2.5 pb-1.5 text-[var(--w-fg-strong)]">
          <button type="button" tabIndex={-1} aria-hidden className="p-1 -ml-1" disabled>
            <HeartGlyph />
          </button>
          <button type="button" tabIndex={-1} aria-hidden className="p-1" disabled>
            <CommentGlyph />
          </button>
          <button type="button" tabIndex={-1} aria-hidden className="p-1" disabled>
            <SendGlyph />
          </button>
          <div className="flex-1" />
          <button type="button" tabIndex={-1} aria-hidden className="p-1 -mr-1" disabled>
            <BookmarkGlyph />
          </button>
        </div>

        <div className="px-3 text-[12.5px] font-semibold text-[var(--w-fg-strong)]">좋아요 0개</div>

        <div className="px-3 pt-1 pb-2 text-[12.5px] text-[var(--w-fg-strong)] leading-[1.5] break-words">
          {caption ? (
            <>
              <span className="font-semibold mr-1.5">{handle}</span>
              {tokens.map((t, i) =>
                t.type === "text" ? (
                  <span key={i} style={{ whiteSpace: "pre-wrap" }}>{t.value}</span>
                ) : (
                  <span key={i} className="text-[#1d6fb8]">{t.value}</span>
                )
              )}
            </>
          ) : (
            <span className="text-[var(--w-fg-alternative)]">캡션을 입력하면 여기에 미리보기가 나타나요</span>
          )}
        </div>

        <div className="px-3 pb-3 text-[10px] uppercase tracking-wide text-[var(--w-fg-alternative)]">방금 전</div>
      </div>
    </div>
  );
}

function HeartGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function SendGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function BookmarkGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
