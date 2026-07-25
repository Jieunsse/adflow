"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, buttonVariants } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import Icon from "@shared/ui/Icon";
import PageSwitcher from "@widgets/facebook/PageSwitcher";
import type { FbManagedPagesResult } from "@/lib/facebook-pages";
import type { FbPagePostsResult, FbPostCommentsResult } from "@/lib/facebook-posts";

function fmtK(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function fmtRel(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!t) return "";
  const diff = Date.now() - t;
  const day = 24 * 60 * 60 * 1000;
  if (diff < 60 * 1000) return "방금";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}분 전`;
  if (diff < day) return `${Math.floor(diff / (60 * 60 * 1000))}시간 전`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function PostCard({ post, pageId }: { post: FbPagePostsResult["posts"][number]; pageId: string | undefined }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["fb-post-comments", post.id, pageId ?? "default"],
    enabled: open,
    queryFn: async (): Promise<FbPostCommentsResult> => {
      const url = pageId
        ? `/api/facebook/posts/${encodeURIComponent(post.id)}/comments?page=${encodeURIComponent(pageId)}`
        : `/api/facebook/posts/${encodeURIComponent(post.id)}/comments`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("댓글을 불러오지 못했어요");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Card className="flex flex-col gap-3 p-0 overflow-hidden">
      {post.fullPicture && (
        <div className="relative w-full aspect-square bg-[var(--w-bg-neutral)]">
          <img src={post.fullPicture} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex flex-col gap-2.5 px-4 pt-1 pb-4">
        {post.message && (
          <p className="m-0 text-[14px] leading-[1.5] text-[var(--w-fg-normal)]" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {post.message}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-[13px] text-[var(--w-fg-neutral)] font-medium">
            <span className="inline-flex items-center gap-1">
              <Icon name="heart" size={14} />
              {fmtK(post.reactionsCount)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="comment" size={14} />
              {fmtK(post.commentsCount)}
            </span>
          </div>
          <span className="text-[12px] text-[var(--w-fg-alternative)]">{fmtRel(post.createdTime)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--w-line-soft)]">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] transition-colors"
          >
            댓글 {fmtK(post.commentsCount)}개
            <Icon name="chev-down" size={12} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 180ms ease" }} />
          </button>
          {post.permalinkUrl && (
            <a
              href={post.permalinkUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--w-fg-neutral)] hover:text-[var(--w-primary-press)]"
            >
              원본 보기
              <Icon name="link" size={12} />
            </a>
          )}
        </div>
        {open && (
          <div className="flex flex-col gap-2 pt-1">
            {isLoading && <div className="text-[13px] text-[var(--w-fg-neutral)] py-2">댓글 불러오는 중…</div>}
            {isError && (
              <div className="flex items-center justify-between gap-2 py-2">
                <span className="text-[13px] text-[var(--w-fg-neutral)]">댓글을 불러오지 못했어요</span>
                <Button size="sm" variant="ghost" type="button" onClick={() => refetch()}>다시</Button>
              </div>
            )}
            {data && data.comments.length === 0 && (
              <div className="text-[13px] text-[var(--w-fg-alternative)] py-2">아직 댓글이 없어요</div>
            )}
            {data && data.comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5 py-1.5">
                {c.fromPictureUrl ? (
                  <img src={c.fromPictureUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[var(--w-bg-neutral)] flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-[13px] text-[var(--w-fg-strong)] truncate">{c.fromName ?? "익명"}</span>
                    <span className="text-[11px] text-[var(--w-fg-alternative)] flex-shrink-0">{fmtRel(c.createdTime)}</span>
                  </div>
                  <p className="m-0 text-[13px] leading-[1.5] text-[var(--w-fg-normal)] break-words">{c.message}</p>
                  {c.likeCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--w-fg-alternative)] mt-0.5">
                      <Icon name="heart" size={11} />
                      {fmtK(c.likeCount)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function FacebookPostsFlow() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageParam = searchParams.get("page") ?? undefined;

  const { data: pagesData } = useQuery({
    queryKey: ["fb-pages"],
    queryFn: async (): Promise<FbManagedPagesResult> => {
      const res = await fetch("/api/facebook/pages");
      if (!res.ok) throw new Error("FB 페이지 목록을 불러오지 못했어요");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const pages = pagesData?.pages ?? [];
  const activePageId = pageParam ?? session?.pageId ?? pages[0]?.id;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["fb-posts", activePageId ?? "default"],
    queryFn: async (): Promise<FbPagePostsResult> => {
      const url = activePageId ? `/api/facebook/posts?page=${encodeURIComponent(activePageId)}` : "/api/facebook/posts";
      const res = await fetch(url);
      if (!res.ok) throw new Error("게시물을 불러오지 못했어요");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const onSelectPage = (id: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", id);
    router.replace(`/facebook/posts?${sp.toString()}`);
  };

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7">
      <div>
        <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">채널 관리 · Facebook</span>
        <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]">게시물</h1>
        <p className="m-0 mt-1 text-[13px] text-[var(--w-fg-neutral)]">페이지가 발행한 최근 게시물과 댓글을 한눈에 확인해요. V1 은 조회 전용이에요.</p>
      </div>

      {pages.length > 0 && (
        <div className="flex items-center gap-2.5">
          <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">관리 페이지</span>
          <PageSwitcher pages={pages} activeId={activePageId} onSelect={onSelectPage} />
        </div>
      )}

      {data?.mock && (
        <Card className="flex items-start gap-3 px-4 py-3 bg-[var(--w-bg-neutral)]">
          <Icon name="info" size={16} style={{ color: "var(--w-fg-neutral)", marginTop: 2 }} />
          <div className="flex flex-col gap-0.5">
            <div className="font-semibold text-[13px] text-[var(--w-fg-strong)]">샘플 데이터를 보고 있어요</div>
            <div className="text-[13px] text-[var(--w-fg-neutral)]">계정 연결 후 실제 페이지 게시물이 표시돼요.</div>
          </div>
        </Card>
      )}

      {!session?.pageId && !data?.mock && (
        <Card className="flex items-center justify-between gap-4">
          <div>
            <div style={{ font: "700 15px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>Meta 계정이 아직 연결되지 않았어요</div>
            <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>Facebook 페이지를 연결하면 실제 게시물을 볼 수 있어요.</div>
          </div>
          <Link href="/connect" className={buttonVariants({ variant: "primary", size: "sm" })}>계정 연결하러 가기</Link>
        </Card>
      )}

      {isLoading && (
        <Card className="flex flex-col items-center gap-3 py-10 px-5 text-[var(--w-fg-neutral)]">
          <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[18px] h-[18px]" />
          <span style={{ font: "500 13px/1 var(--w-font-sans)" }}>게시물을 불러오는 중…</span>
        </Card>
      )}

      {isError && (
        <Card className="flex flex-col items-center gap-3 py-8 px-5 text-center">
          <div style={{ font: "700 15px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>게시물을 불러오지 못했어요</div>
          <Button variant="primary" size="sm" type="button" onClick={() => refetch()}>다시 시도</Button>
        </Card>
      )}

      {!isLoading && !isError && data && data.posts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.posts.map((p) => (
            <PostCard key={p.id} post={p} pageId={activePageId} />
          ))}
        </div>
      )}

      {!isLoading && !isError && data && data.posts.length === 0 && (
        <Card className="flex flex-col items-center gap-2 py-10 px-5 text-center text-[var(--w-fg-neutral)]">
          <Icon name="image" size={20} />
          <div className="text-[13px]">표시할 게시물이 없어요</div>
        </Card>
      )}
    </div>
  );
}

export default function FacebookPostsPage() {
  return (
    <Suspense fallback={null}>
      <FacebookPostsFlow />
    </Suspense>
  );
}
