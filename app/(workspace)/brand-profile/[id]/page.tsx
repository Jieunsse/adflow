"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { useBrandProfilesStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import { seedDemoIfEmpty } from "@features/brand-profile/model/seed-demo";
import { usePersonasForProfile } from "@features/brand-profile/model/usePersonasStorage";
import { isSectionFilled } from "@features/sop/model/useSopStorage";
import { SOP_SECTION_ORDER } from "@features/sop/model/section-labels";
import SopCard from "@features/sop/ui/SopCard";
import PersonaCard from "@features/brand-profile/ui/PersonaCard";
import ProductCard from "@features/brand-profile/ui/ProductCard";
import { useProducts } from "@shared/lib/products";
import EmptyCard from "@features/brand-profile/ui/EmptyCard";
import StyleSection from "@features/brand-profile/ui/StyleSection";
import Panel from "@features/brand-profile/ui/Panel";
import StatTile from "@features/brand-profile/ui/StatTile";
import LearningSection from "@features/brand-profile/ui/LearningSection";
import { SegControl } from "@shared/ui/SegControl";
import { readLedger } from "@entities/ab-test/tournament/ledger";
import { seedDemoLedger } from "@features/brand-profile/model/seed-ledger";
import type { Hypothesis } from "@entities/ab-test/tournament/tournament";

type ProfileTab = "identity" | "policy" | "audience" | "learning";

export default function BrandProfileViewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  seedDemoIfEmpty();

  const { profiles } = useBrandProfilesStorage();
  const { personas } = usePersonasForProfile(id);
  const { products } = useProducts(id);

  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<ProfileTab>(
    searchParams.get("tab") === "learning" ? "learning" : "identity",
  );
  const [ledger, setLedger] = useState<Hypothesis[]>([]);
  useEffect(() => {
    seedDemoLedger(id);
    setLedger(readLedger(id));
  }, [id]);

  useEffect(() => {
    if (profiles.length === 0 && !loaded) return;
    setLoaded(true);
    if (!profiles.find((p) => p.id === id)) {
      router.replace("/brand-profile");
    }
  }, [profiles, id, loaded, router]);

  if (!loaded) {
    return <div className="px-12 py-9 text-[var(--w-fg-neutral)]">불러오는 중…</div>;
  }

  const entry = profiles.find((p) => p.id === id);
  if (!entry) return null;

  const editHref = `/brand-profile/${id}/edit`;
  const policy = entry.policy ?? [];
  const filledPolicy = SOP_SECTION_ORDER.filter((type) =>
    policy.some((s) => s.type === type && isSectionFilled(s))
  );
  const proofCount = entry.proofPoints?.length ?? 0;
  const refCount = entry.copyReferences?.length ?? 0;

  return (
    <div className="px-12 py-9 pb-20 max-w-[1180px] w-full mx-auto">
      {/* 뒤로가기 */}
      <Link
        href="/brand-profile"
        className="inline-flex items-center gap-1.5 mb-4 font-medium text-[13px] leading-none text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] transition-colors no-underline"
      >
        <Icon name="arrow-left" size={14} /> 브랜드 프로필 목록
      </Link>

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid place-items-center w-14 h-14 rounded-2xl bg-[var(--w-bg-inverse)] text-[var(--w-bg-elevated)] font-extrabold text-[24px] leading-none shrink-0">
            {entry.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="m-0 font-bold text-[28px] leading-[1.2] tracking-[-0.024em] text-[var(--w-fg-strong)]">
                {entry.name}
              </h1>
              {entry.isDefault && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[var(--w-primary-soft)] font-semibold text-[12px] leading-none text-[var(--w-primary-normal)]">
                  기본값
                </span>
              )}
            </div>
            <p className="m-0 mt-2 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">
              광고 카피·타깃·정책의 기준이 되는 브랜드 정체성이에요.
            </p>
          </div>
        </div>
        <Link href={editHref} className="shrink-0">
          <Button variant="secondary" type="button">
            <Icon name="settings" size={15} /> 수정
          </Button>
        </Link>
      </div>

      {/* KPI 요약 타일 */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <StatTile icon="lock" label="정책" value={filledPolicy.length} accent="var(--w-accent-violet)" />
        <StatTile icon="users" label="페르소나" value={personas.length} accent="var(--w-primary-normal)" />
        <StatTile icon="grid" label="제품" value={products.length} accent="var(--w-status-positive)" />
        <StatTile icon="chart" label="근거 자료" value={proofCount} accent="var(--w-status-warning)" />
        <StatTile icon="copy" label="카피 레퍼런스" value={refCount} accent="var(--w-fg-neutral)" />
      </div>

      {/* 세부 탭 */}
      <SegControl
        value={tab}
        onChange={setTab}
        options={[
          { value: "identity", label: "정체성" },
          { value: "policy", label: `정책 ${filledPolicy.length}` },
          { value: "audience", label: `타깃 · 제품 ${personas.length + products.length}` },
          { value: "learning", label: `학습 ${ledger.filter((h) => h.verdict).length}` },
        ]}
        className="mb-4"
      />

      {/* 정체성 — 스타일 보드 */}
      {tab === "identity" && <StyleSection entry={entry} />}

      {/* 정책 — 풀폭 패널 */}
      {tab === "policy" && (
        <Panel
          title="정책"
          icon="lock"
          count={filledPolicy.length}
          desc="광고 카피에 적용되는 금지·필수 규칙이에요."
        >
          <div className="grid grid-cols-4 gap-3">
            {filledPolicy.map((type) => (
              <SopCard key={type} type={type} section={policy.find((s) => s.type === type)} canEdit={false} onEdit={() => {}} />
            ))}
            <EmptyCard label="미설정" hint="새 정책 항목" href={editHref} />
          </div>
        </Panel>
      )}

      {/* 타깃 · 제품 */}
      {tab === "audience" && (
        <Panel
          title="타깃 · 제품"
          icon="users"
          desc="이 브랜드가 겨냥하는 페르소나와 광고에 연결할 대표 제품이에요."
          bodyClassName="flex flex-col gap-4"
        >
          <Panel
            title="페르소나"
            icon="users"
            count={personas.length}
            desc="이 브랜드가 가장 자주 겨냥하는 타깃이에요."
            nested
          >
            <div className="grid grid-cols-3 gap-3">
              {personas.map((p, i) => (
                <PersonaCard key={p.id} persona={p} index={i} canEdit={false} onEdit={() => {}} onDelete={() => {}} />
              ))}
              <EmptyCard label="미설정" hint="새 페르소나" href={editHref} />
            </div>
          </Panel>

          <Panel
            title="제품"
            icon="grid"
            count={products.length}
            desc="광고에 연결할 수 있는 대표 제품이에요."
            nested
          >
            <div className="grid grid-cols-4 gap-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} canEdit={false} onEdit={() => {}} onDelete={() => {}} />
              ))}
              <EmptyCard label="미등록" hint="새 제품" href={editHref} />
            </div>
          </Panel>
        </Panel>
      )}

      {/* 학습 — A/B 검증 가설 아카이브 (ADR-044/050) */}
      {tab === "learning" && <LearningSection entries={ledger} products={products} />}
    </div>
  );
}
