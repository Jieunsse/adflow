"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Dialog, DialogContent, DialogTitle } from "@shared/ui/Dialog";
import { useToast } from "@shared/ui/Toast";
import { KpiCard } from "@shared/ui/primitives";
import DualChart from "@shared/ui/DualChart";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import {
  summarizeReels,
  serializeReelsReportText,
  toReelsCsv,
  type IgReel,
  type IgReelsPanel,
} from "@/lib/instagram-reels";

type UploadResp = { ok: true; url: string } | { ok: false; error: string };
type PublishResp =
  | { ok: true; mediaId: string; permalink?: string; mock?: boolean }
  | { ok: false; error: string; status?: number };

function fmtK(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function MockBadge() {
  return (
    <div
      className="inline-flex items-center gap-1.5 py-1 px-2 rounded-md bg-[var(--w-bg-alternative)] w-fit"
      style={{
        font: "600 11px/1 var(--w-font-sans)",
        color: "var(--w-fg-neutral)",
      }}
    >
      샘플 데이터
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center gap-2 py-12 px-6 text-center">
      <Icon name="play" size={32} style={{ opacity: 0.35 }} />
      <span
        style={{
          font: "600 14px/1.4 var(--w-font-sans)",
          color: "var(--w-fg-strong)",
        }}
      >
        아직 릴스가 없어요. 첫 릴스를 올려보세요.
      </span>
    </Card>
  );
}

function ReelCard({ reel, onClick }: { reel: IgReel; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col gap-2 p-2 rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-elevated)] text-left",
        "transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
      )}
    >
      <div className="relative w-full aspect-[9/16] rounded-lg overflow-hidden bg-[var(--w-bg-alternative)]">
        {reel.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reel.coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Icon name="play" size={28} style={{ opacity: 0.35 }} />
          </div>
        )}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-2.5 flex items-end">
          <span
            className="text-white line-clamp-3"
            style={{ font: "500 11.5px/1.4 var(--w-font-sans)" }}
          >
            {reel.caption || "(캡션 없음)"}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between px-0.5">
        <span
          className="inline-flex items-center gap-1"
          style={{ font: "600 11px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}
        >
          <Icon name="play" size={11} />
          {fmtK(reel.insights.plays)}
        </span>
        <span
          className="inline-flex items-center gap-1"
          style={{ font: "600 11px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}
        >
          <Icon name="heart" size={11} />
          {fmtK(reel.insights.likes)}
        </span>
        <span
          className="inline-flex items-center gap-1"
          style={{ font: "600 11px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}
        >
          <Icon name="comment" size={11} />
          {fmtK(reel.insights.comments)}
        </span>
      </div>
    </button>
  );
}

function ReelDetailDialog({ reel, onOpenChange }: { reel: IgReel | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={!!reel} onOpenChange={onOpenChange}>
      <DialogContent className="w-[420px] p-6 flex flex-col gap-4">
        {reel && (
          <>
            <DialogTitle style={{ font: "700 16px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
              릴스 상세
            </DialogTitle>
            <p
              className="whitespace-pre-wrap"
              style={{ font: "500 13px/1.6 var(--w-font-sans)", color: "var(--w-fg-strong)" }}
            >
              {reel.caption || "(캡션 없음)"}
            </p>
            <div className="h-px bg-[var(--w-line-alternative)]" />
            <div className="grid grid-cols-2 gap-2.5">
              {[
                ["조회", reel.insights.plays],
                ["도달", reel.insights.reach],
                ["좋아요", reel.insights.likes],
                ["댓글", reel.insights.comments],
                ["공유", reel.insights.shares],
                ["저장", reel.insights.saved],
                ["총 반응", reel.insights.totalInteractions],
              ].map(([label, value]) => (
                <div key={label as string} className="flex items-center justify-between">
                  <span style={{ font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
                    {label}
                  </span>
                  <span style={{ font: "600 13px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
                    {fmtK(value as number)}
                  </span>
                </div>
              ))}
            </div>
            {reel.permalink && (
              <a
                href={reel.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--w-line-normal)] hover:bg-[var(--w-bg-neutral)] transition-colors"
                style={{ font: "600 13px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}
              >
                <Icon name="link" size={13} />
                인스타그램에서 보기
              </a>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  onPublished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublished: () => void;
}) {
  const showToast = useToast();
  const [videoUrl, setVideoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [shareToFeed, setShareToFeed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/instagram/reels/upload", { method: "POST", body: fd });
      const data = (await res.json()) as UploadResp;
      if (data.ok) {
        setVideoUrl(data.url);
      } else {
        showToast(`업로드 실패 — ${data.error}`);
      }
    } catch (e) {
      showToast(`업로드 실패 — ${e instanceof Error ? e.message : "요청 실패"}`);
    } finally {
      setUploading(false);
    }
  }, [showToast]);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const canSubmit = videoUrl.trim().length > 0 && !uploading && !publishing;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/instagram/reels/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoUrl.trim(), caption: caption.trim(), shareToFeed }),
      });
      const data = (await res.json()) as PublishResp;
      if (data.ok) {
        showToast("릴스를 게시했어요");
        setVideoUrl("");
        setCaption("");
        setShareToFeed(false);
        onOpenChange(false);
        onPublished();
      } else {
        showToast(`게시 실패 — ${data.error}`);
      }
    } catch (e) {
      showToast(`게시 실패 — ${e instanceof Error ? e.message : "요청 실패"}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[440px] p-6">
        <DialogTitle style={{ font: "700 16px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
          릴스 올리기
        </DialogTitle>
        <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
            className="rounded-[14px] border-2 border-dashed border-[var(--w-line-normal)] bg-[var(--w-bg-base)] hover:border-[var(--w-line-strong)] cursor-pointer grid place-items-center py-8 px-4 text-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/*"
              onChange={onFileInputChange}
              className="hidden"
            />
            <Icon name="upload" size={24} />
            <div className="mt-2" style={{ font: "600 13px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
              {uploading ? "업로드 중…" : videoUrl ? "영상 선택됨 — 다시 고르려면 클릭" : "클릭해서 영상 파일을 골라주세요"}
            </div>
          </div>

          <textarea
            placeholder="캡션을 입력해 주세요"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            className="px-3.5 py-3 rounded-[10px] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[14px] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] resize-y leading-[1.55]"
            disabled={publishing}
          />

          <label className="flex items-center gap-2 cursor-pointer" style={{ font: "500 13px/1 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
            <input
              type="checkbox"
              checked={shareToFeed}
              onChange={(e) => setShareToFeed(e.target.checked)}
              disabled={publishing}
            />
            피드에도 공유
          </label>

          <Button type="submit" variant="primary" size="md" disabled={!canSubmit} className="w-full">
            {publishing ? "게시 중…" : "게시하기"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Reels() {
  const showToast = useToast();
  const queryClient = useQueryClient();
  const [selectedReel, setSelectedReel] = useState<IgReel | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const q = useQuery({
    queryKey: ["ig-reels"],
    queryFn: async (): Promise<IgReelsPanel> => {
      const res = await fetch("/api/instagram/reels");
      if (!res.ok) throw new Error("릴스를 불러오지 못했어요");
      return res.json();
    },
    staleTime: 60_000,
  });

  const onCopyReport = useCallback(async (reels: IgReel[]) => {
    await navigator.clipboard.writeText(serializeReelsReportText(reels));
    showToast("리포트를 복사했어요");
  }, [showToast]);

  const onDownloadCsv = useCallback((reels: IgReel[]) => {
    const csv = toReelsCsv(reels);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `릴스성과_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (q.isLoading) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 px-5 text-[var(--w-fg-neutral)]">
        <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[18px] h-[18px]" />
        <span style={{ font: "500 13px/1 var(--w-font-sans)" }}>
          릴스를 불러오는 중…
        </span>
      </Card>
    );
  }

  if (q.isError || !q.data) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 px-5 text-center text-[var(--w-fg-neutral)]">
        릴스를 불러오지 못했어요.
      </Card>
    );
  }

  const { reels, mock } = q.data;
  const summary = summarizeReels(reels);
  const sorted = [...reels].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          {mock && <MockBadge />}
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="릴스 수" value={String(summary.count)} />
            <KpiCard label="총 조회수" value={fmtK(summary.totalPlays)} />
            <KpiCard label="총 도달" value={fmtK(summary.totalReach)} />
            <KpiCard label="평균 참여율" value={summary.avgEngagementRate.toFixed(1)} suffix="%" />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={() => onCopyReport(reels)} disabled={reels.length === 0}>
            <Icon name="copy" size={13} />
            리포트 복사
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onDownloadCsv(reels)} disabled={reels.length === 0}>
            <Icon name="upload" size={13} />
            CSV 다운로드
          </Button>
          <Button variant="primary" size="sm" onClick={() => setUploadOpen(true)}>
            릴스 올리기
          </Button>
        </div>
      </div>

      <Card variant="default">
        <h2 className="font-bold text-[14px] text-[var(--w-fg-strong)] mb-3">성과 추이</h2>
        {sorted.length >= 2 ? (
          <DualChart
            labels={sorted.map((r) => fmtDate(r.timestamp))}
            bars={sorted.map((r) => r.insights.plays)}
            line={sorted.map((r) =>
              r.insights.plays > 0 ? (r.insights.totalInteractions / r.insights.plays) * 100 : 0,
            )}
            lineFormat={(v) => v.toFixed(1) + "%"}
          />
        ) : (
          <div className="py-8 text-center" style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-alternative)" }}>
            릴스가 2개 이상 쌓이면 추이를 볼 수 있어요.
          </div>
        )}
      </Card>

      {reels.length === 0 && !mock ? (
        <EmptyState />
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
        >
          {reels.map((r) => (
            <ReelCard key={r.id} reel={r} onClick={() => setSelectedReel(r)} />
          ))}
        </div>
      )}

      <ReelDetailDialog reel={selectedReel} onOpenChange={(open) => !open && setSelectedReel(null)} />
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onPublished={() => queryClient.invalidateQueries({ queryKey: ["ig-reels"] })}
      />
    </div>
  );
}
