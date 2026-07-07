"use client";

import Link from "next/link";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import { EmptyState } from "@shared/ui/primitives";
import { CreatorAvatar } from "@features/creator-registry";
import type { CreatorRankResult } from "@entities/creator/model";

export function RankingPanel({
  results,
  hasAnyHistory,
  onAdd,
}: {
  results: CreatorRankResult[];
  hasAnyHistory: boolean;
  onAdd: (creatorId: string) => void;
}) {
  if (results.length === 0) return null;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 font-bold text-[16px] leading-[1.3] text-[var(--w-fg-strong)]">적합도 랭킹</h2>
        <Chip variant="neutral">{results.length}명</Chip>
      </div>
      {!hasAnyHistory && (
        <div className="flex items-start gap-1.5 font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-alternative)]">
          <Icon name="info" size={13} className="mt-px shrink-0" />
          <span>아직 협업 이력이 없어 카테고리 기준으로 정렬했어요.</span>
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        {results.map((r) => (
          <div
            key={r.creator.id}
            className="flex items-center gap-3 rounded-xl border border-[var(--w-line-alternative)] px-4 py-3"
          >
            <CreatorAvatar creator={r.creator} size={40} />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[14px] leading-[1.3] text-[var(--w-fg-strong)] truncate">
                {r.creator.handle}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {r.reasons.map((reason) => (
                  <Chip key={reason} variant="neutral" size="sm">
                    {reason}
                  </Chip>
                ))}
              </div>
            </div>
            <Button variant="secondary" size="sm" type="button" onClick={() => onAdd(r.creator.id)}>
              파이프라인에 담기
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RankingEmptyState() {
  return (
    <EmptyState
      icon={<Icon name="users" size={22} />}
      title="등록된 크리에이터가 없어요"
      desc="먼저 크리에이터를 등록하면 이 캠페인에 맞는 순서로 보여드려요."
      action={
        <Link href="/creators" className="no-underline">
          <Button variant="primary" type="button">
            크리에이터 장부로 이동
          </Button>
        </Link>
      }
    />
  );
}
