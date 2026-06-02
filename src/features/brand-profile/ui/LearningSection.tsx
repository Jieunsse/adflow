"use client";

// ADR-044/050 — 브랜드 프로필 '학습' 탭. A/B 테스트로 검증돼 이 브랜드에 누적된 가설의 정본 아카이브.
// 토너먼트 상세 학습 노트(접힘 요약)와 달리 제품·목표별로 전부 펼쳐 보여준다. 같은 row 렌더러 공유.

import Panel from "./Panel";
import { HypothesisDetailRow, latestByProduct } from "@entities/ab-test/tournament/ui/ledger-view";
import type { Hypothesis } from "@entities/ab-test/tournament/tournament";

export default function LearningSection({
  entries,
  products,
}: {
  entries: Hypothesis[];
  products: { id: string; name: string }[];
}) {
  const groups = latestByProduct(entries);
  const nameOf = (pid: string) => products.find((p) => p.id === pid)?.name ?? "삭제된 제품";
  return (
    <Panel
      title="학습"
      icon="sparkles"
      count={groups.reduce((n, g) => n + g.items.length, 0)}
      desc="A/B 테스트로 검증해 이 브랜드에 쌓인 가설이에요. 카피를 만들 때 추천 훅에도 반영돼요."
      bodyClassName="flex flex-col gap-4"
    >
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--w-line-normal)] py-10 text-center font-medium text-[13px] leading-[1.6] text-[var(--w-fg-neutral)]">
          아직 검증된 가설이 없어요.
          <br />
          A/B 테스트(이기는 광고 찾기)를 돌리면 결과가 여기 쌓여요.
        </div>
      ) : (
        groups.map((g) => (
          <Panel key={g.productId} title={nameOf(g.productId)} icon="grid" count={g.items.length} nested bodyClassName="flex flex-col gap-2">
            {g.items.map((h) => (
              <HypothesisDetailRow key={h.id} h={h} />
            ))}
          </Panel>
        ))
      )}
    </Panel>
  );
}
