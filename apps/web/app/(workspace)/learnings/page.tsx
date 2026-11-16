"use client";

// 광고 노하우 — 배운 것 목록 (기능명세 4-1). 지금 고른 브랜드의 기록을 확정·초안·보관 탭으로 나눠 보여 준다.
// 숫자와 결과는 고칠 수 없고, 문장만 고친다. 확정한 기록만 다음 실험의 가설에 쓴다 (정책서 14.2·14.4).
// shortcut: 상세 오른쪽 패널(4-2)·거르기·과거 기록 탭 없이 카드 안에서 고치고 확정한다. 화면 시안을 옮길 때 나눈다.

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip, type ChipVariant } from "@shared/ui/Chip";
import { Skeleton } from "@shared/ui/Skeleton";
import { useToast } from "@shared/ui/Toast";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";

type Learning = {
  id: string;
  tournamentId: string;
  productName?: string;
  roundIndex: number;
  axis?: string;
  hypothesis?: string;
  result: "challenger_won" | "champion_won" | "no_difference" | "unjudgeable";
  sentence?: string;
  status: "draft" | "confirmed" | "archived";
  archiveReason?: string;
  createdAt: string;
};

type Tab = "confirmed" | "draft" | "archived";

const TABS: { key: Tab; label: string }[] = [
  { key: "confirmed", label: "확정" },
  { key: "draft", label: "초안" },
  { key: "archived", label: "보관" },
];

const RESULT: Record<Learning["result"], { label: string; variant: ChipVariant }> = {
  challenger_won: { label: "도전 소재 이김", variant: "success" },
  champion_won: { label: "기준 소재 이김", variant: "accent" },
  no_difference: { label: "차이 없음", variant: "neutral" },
  unjudgeable: { label: "판정 불가", variant: "warn" },
};

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

async function send(url: string, method: "PUT" | "POST", body?: object): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "저장하지 못했어요. 잠시 뒤 다시 해 주세요.");
  }
}

export default function LearningsPage() {
  const { data: session } = useSession();
  const { activeId, profiles } = useBrandProfileStorage();
  const brandName = profiles.find((p) => p.id === activeId)?.name;
  const [tab, setTab] = useState<Tab>("draft");
  const qc = useQueryClient();
  const showToast = useToast();
  const canDecide = session?.role === "팀장" || session?.role === "팀원·게재";

  const q = useQuery({
    queryKey: ["learnings", activeId],
    queryFn: async () => {
      const res = await fetch(`/api/learnings?brandProfileId=${encodeURIComponent(activeId!)}`);
      if (!res.ok) throw new Error("배운 것을 불러오지 못했어요.");
      return ((await res.json()) as { items: Learning[] }).items;
    },
    enabled: !!activeId && !session?.browseMode,
  });
  const all = q.data ?? [];
  const list = all.filter((l) => l.status === tab);

  const run = async (op: Promise<void>, ok: string) => {
    try {
      await op;
      showToast(ok);
      await qc.invalidateQueries({ queryKey: ["learnings", activeId] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "저장하지 못했어요.");
    }
  };

  return (
    <div className="px-12 py-9 pb-16 max-w-[960px] w-full mx-auto flex flex-col gap-6" data-screen-label="광고 노하우">
      <div>
        <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">
          {brandName ?? "브랜드"}
        </span>
        <h1 className="m-0 mt-1 font-bold text-[28px] leading-[1.25] text-[var(--w-fg-strong)]">광고 노하우</h1>
        <p className="font-medium text-[14px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1.5 mb-0">
          판정이 끝난 실험에서 배운 것이에요. 확정한 것만 다음 실험을 만들 때 써요.
        </p>
      </div>

      <div className="flex gap-2" role="tablist">
        {TABS.map((t) => (
          <Button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            variant={tab === t.key ? "primary" : "secondary"}
            type="button"
            onClick={() => setTab(t.key)}
          >
            {t.label} {all.filter((l) => l.status === t.key).length}
          </Button>
        ))}
      </div>

      {session?.browseMode ? (
        <Card className="py-8 px-6 font-medium text-[13px] text-[var(--w-fg-neutral)]">둘러보기에서는 배운 것을 저장하지 않아요.</Card>
      ) : q.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : q.isError ? (
        <Card className="py-8 px-6 font-medium text-[13px] text-[var(--w-fg-neutral)]">
          배운 것을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
        </Card>
      ) : list.length === 0 ? (
        <Card className="py-10 px-6 flex flex-col items-center gap-3 text-center">
          <span className="font-medium text-[14px] text-[var(--w-fg-neutral)]">
            {tab === "draft" ? "아직 판정이 끝난 실험이 없어요. 첫 실험을 시작해 보세요." : "여기에 보일 기록이 아직 없어요."}
          </span>
          {tab === "draft" && (
            <Link href="/ab-tests/new">
              <Button variant="primary" type="button">실험 만들기</Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((l) => (
            <LearningCard
              key={l.id}
              l={l}
              canDecide={canDecide}
              onSave={(sentence) => run(send(`/api/learnings/${l.id}/sentence`, "PUT", { sentence }), "문장을 고쳤어요")}
              onConfirm={() => run(send(`/api/learnings/${l.id}/confirm`, "POST"), "확정했어요. 다음 실험부터 써요")}
              onArchive={(reason) => run(send(`/api/learnings/${l.id}/archive`, "POST", { reason }), "보관했어요")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LearningCard({ l, canDecide, onSave, onConfirm, onArchive }: {
  l: Learning;
  canDecide: boolean;
  onSave: (sentence: string) => void;
  onConfirm: () => void;
  onArchive: (reason: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(l.sentence ?? "");
  const [archiving, setArchiving] = useState(false);
  const [reason, setReason] = useState("");
  const [openedAt] = useState(() => Date.now());
  const stale = l.status === "draft" && openedAt - Date.parse(l.createdAt) > STALE_MS;
  const r = RESULT[l.result];

  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Chip variant={r.variant}>{r.label}</Chip>
        <Chip variant="neutral">{l.axis === "primary_text" ? "본문" : "헤드라인"}</Chip>
        {stale && <Chip variant="warn">오래됨</Chip>}
        <span className="ml-auto font-medium text-[12px] text-[var(--w-fg-neutral)]">
          <Link href={`/ab-tests/${l.tournamentId}`} className="underline">
            {l.productName ?? "실험"} · 실험 {l.roundIndex}
          </Link>{" "}
          · {new Date(l.createdAt).toLocaleDateString("ko-KR")}
        </span>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`s-${l.id}`} className="font-semibold text-[13px] text-[var(--w-fg-strong)]">문장 (200자 이하)</label>
          <textarea
            id={`s-${l.id}`}
            value={text}
            maxLength={200}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-[var(--w-line-normal)] p-3 text-[14px] text-[var(--w-fg-strong)] bg-[var(--w-bg-elevated)]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => { setText(l.sentence ?? ""); setEditing(false); }}>취소</Button>
            <Button variant="primary" type="button" disabled={!text.trim()} onClick={() => { onSave(text.trim()); setEditing(false); }}>저장하기</Button>
          </div>
        </div>
      ) : (
        <p className="m-0 font-medium text-[15px] leading-[1.6] text-[var(--w-fg-strong)]">{l.sentence}</p>
      )}

      {l.hypothesis && <p className="m-0 font-medium text-[13px] text-[var(--w-fg-neutral)]">가설 · {l.hypothesis}</p>}
      {l.status === "archived" && l.archiveReason && (
        <p className="m-0 font-medium text-[13px] text-[var(--w-fg-neutral)]">보관한 이유 · {l.archiveReason}</p>
      )}

      {archiving ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`a-${l.id}`} className="font-semibold text-[13px] text-[var(--w-fg-strong)]">보관하는 이유</label>
          <input
            id={`a-${l.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-[var(--w-line-normal)] p-3 text-[14px] text-[var(--w-fg-strong)] bg-[var(--w-bg-elevated)]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setArchiving(false)}>취소</Button>
            <Button variant="primary" type="button" disabled={!reason.trim()} onClick={() => { onArchive(reason.trim()); setArchiving(false); }}>보관하기</Button>
          </div>
        </div>
      ) : (
        !editing && (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setEditing(true)}>문장 고치기</Button>
            {canDecide && l.status !== "archived" && (
              <Button variant="secondary" type="button" onClick={() => setArchiving(true)}>보관하기</Button>
            )}
            {canDecide && l.status !== "confirmed" && (
              <Button variant="primary" type="button" onClick={onConfirm}>
                {l.status === "archived" ? "다시 확정하기" : "확정하기"}
              </Button>
            )}
          </div>
        )
      )}
    </Card>
  );
}
