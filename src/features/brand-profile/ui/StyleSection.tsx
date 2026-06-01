import type { ReactNode } from "react";
import { Card } from "@shared/ui/Card";
import Panel from "@features/brand-profile/ui/Panel";
import type { BrandProfileEntry } from "@features/brand-profile/model/useBrandProfileStorage";

function IdentityLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-semibold text-[13px] leading-[1.4] text-[var(--w-fg-neutral)] whitespace-nowrap pt-1">
      {children}
    </span>
  );
}

function Empty() {
  return <span className="font-medium text-[14px] text-[var(--w-fg-alternative)] italic">미입력</span>;
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="grid place-items-center text-center py-8 px-4 h-full">
      <div>
        <div className="mb-1.5 font-semibold text-[13px] leading-[1.4] text-[var(--w-fg-neutral)]">{title}</div>
        <div className="mx-auto max-w-[360px] font-medium text-[12px] leading-[1.6] text-[var(--w-fg-alternative)]">
          {hint}
        </div>
      </div>
    </div>
  );
}

export default function StyleSection({ entry }: { entry: BrandProfileEntry }) {
  const refs = entry.copyReferences ?? [];
  const proofPoints = entry.proofPoints ?? [];
  const description = entry.brandDescription?.trim();
  const customerVoice = entry.customerVoiceSummary?.trim();

  return (
    <Panel
      title="브랜드 정체성"
      icon="sparkles"
      desc="광고 카피와 이미지의 톤이 되는 정체성·근거·레퍼런스예요."
      bodyClassName="grid grid-cols-2 gap-4 items-stretch"
    >
      {/* 정체성 요약 — 풀폭 헤더 */}
      <Panel title="한눈에 보는 브랜드 정체성" nested className="col-span-2">
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-5 items-start">
          <IdentityLabel>광고 느낌</IdentityLabel>
          <div>
            {entry.tone ? (
              <span className="inline-flex items-center px-3.5 py-[7px] rounded-full bg-[var(--w-bg-inverse)] text-[var(--w-bg-elevated)] font-semibold text-[14px] leading-none">
                {entry.tone}
              </span>
            ) : (
              <Empty />
            )}
          </div>

          <IdentityLabel>브랜드 보이스</IdentityLabel>
          {entry.brandVoice ? (
            <p className="m-0 font-semibold text-[16px] leading-[1.5] text-[var(--w-fg-strong)]">{entry.brandVoice}</p>
          ) : (
            <Empty />
          )}

          <IdentityLabel>브랜드 미감</IdentityLabel>
          {entry.imageGuide ? (
            <p className="m-0 font-medium text-[16px] leading-[1.55] text-[var(--w-fg-normal)]">{entry.imageGuide}</p>
          ) : (
            <Empty />
          )}
        </div>
      </Panel>

      <Panel title="브랜드 설명" icon="doc" nested className="h-full">
        {description ? (
          <div className="flex flex-col gap-4">
            {description.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="m-0 font-normal text-[15px] leading-[1.75] text-[var(--w-fg-normal)]">
                {para}
              </p>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel title="고객 목소리 요약" icon="message" nested className="h-full">
        {customerVoice ? (
          <Card variant="quiet" className="flex gap-3 bg-[var(--w-bg-elevated)] border-[var(--w-line-normal)]">
            <span className="shrink-0 font-bold text-[36px] leading-[0.9] text-[var(--w-line-normal)] select-none">“</span>
            <p className="m-0 pt-1 font-normal text-[15px] leading-[1.75] text-[var(--w-fg-normal)]">{customerVoice}</p>
          </Card>
        ) : (
          <Empty />
        )}
      </Panel>

      {/* 근거 자료 — 성과 수치의 유일한 출처 (ADR-031) */}
      <Panel title="근거 자료" icon="chart" count={proofPoints.length} nested className="h-full">
        {proofPoints.length === 0 ? (
          <EmptyState
            title="아직 등록된 근거 자료가 없어요"
            hint="재구매율·판매량·별점·수상 같은 검증된 사실을 등록하면, AI가 그 수치만 카피에 인용하고 없는 수치는 지어내지 않아요."
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {proofPoints.map((pp, i) => (
              <span
                key={i}
                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-[1.4] text-[var(--w-fg-strong)]"
              >
                {pp}
              </span>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="카피 레퍼런스" icon="copy" count={refs.length} nested className="h-full">
        {refs.length === 0 ? (
          <EmptyState
            title="아직 등록된 카피 레퍼런스가 없어요"
            hint="AI가 카피를 만들 때 따라할 예시 문장을 등록하면, 더 브랜드다운 결과를 받을 수 있어요."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {refs.map((ref) => (
              <div
                key={ref.id}
                className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)]"
              >
                <div className="flex-1 min-w-0">
                  <p className="m-0 font-medium text-[13px] leading-[1.55] text-[var(--w-fg-strong)] break-words">
                    {ref.text}
                  </p>
                  <span className="font-medium text-[11px] text-[var(--w-fg-alternative)]">
                    {ref.source === "ig" ? "IG" : "직접 입력"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </Panel>
  );
}
