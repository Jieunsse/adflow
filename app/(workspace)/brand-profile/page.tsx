"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { useToast } from "@shared/ui/Toast";
import ConfirmModal from "@shared/ui/ConfirmModal";
import { cn } from "@shared/lib/cn";
import { TONES } from "@entities/creative/options";
import {
  useBrandProfilesStorage,
  type BrandProfileEntry,
} from "@features/brand-profile/model/useBrandProfileStorage";
import { seedDemoIfEmpty } from "@features/brand-profile/model/seed-demo";
import { readPersonas, type PersonaEntry } from "@features/brand-profile/model/usePersonasStorage";
import { isSectionFilled } from "@features/sop/model/useSopStorage";
import { SOP_SECTION_LABEL } from "@features/sop/model/section-labels";
import { SECTION_ACCENT } from "@features/sop/ui/section-style";

const GENDER_LABEL: Record<number, string> = { 1: "남", 2: "여" };

function personaChipLabel(p: PersonaEntry): string {
  const age =
    p.ageMin != null && p.ageMax != null
      ? `${p.ageMin}–${p.ageMax}세`
      : p.ageMin != null
        ? `${p.ageMin}세+`
        : p.ageMax != null
          ? `~${p.ageMax}세`
          : null;
  const gender =
    !p.genders || p.genders.length === 0
      ? "전체"
      : p.genders.map((g) => GENDER_LABEL[g] ?? g).join("·");
  return [p.name, age, gender].filter(Boolean).join(" · ");
}

interface ProfileCardProps {
  profile: BrandProfileEntry;
  personas: PersonaEntry[];
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

function ProfileCard({ profile, personas, onDelete, onSetDefault }: ProfileCardProps) {
  const router = useRouter();
  const toneLabel = profile.tone ? TONES.find((t) => t.id === profile.tone)?.label : null;
  const filledSections = (profile.policy ?? []).filter(isSectionFilled);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const goToDetail = () => router.push(`/brand-profile/${profile.id}`);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={goToDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter") goToDetail();
        if (e.key === " ") {
          e.preventDefault();
          goToDetail();
        }
      }}
      className={cn(
        "rounded-2xl border bg-[var(--w-bg-elevated)] p-5 flex flex-col gap-4 transition-[border-color,box-shadow] duration-[120ms] hover:border-[var(--w-primary-normal)] hover:shadow-[0_0_0_4px_color-mix(in_srgb,var(--w-primary-normal)_8%,transparent)] focus-visible:border-[var(--w-primary-normal)] focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--w-primary-normal)_8%,transparent)] focus-visible:outline-none cursor-pointer",
        profile.isDefault ? "border-[var(--w-primary-normal)]" : "border-[var(--w-line-normal)]"
      )}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[16px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">
              {profile.name}
            </span>
            {profile.isDefault && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--w-primary-soft)] font-semibold text-[11px] text-[var(--w-primary-normal)]">
                기본값
              </span>
            )}
            {toneLabel && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--w-bg-alternative)] font-medium text-[11px] text-[var(--w-fg-neutral)]">
                {toneLabel}
              </span>
            )}
          </div>
          {profile.brandDescription && (
            <p className="m-0 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-normal)] line-clamp-2">
              {profile.brandDescription}
            </p>
          )}
        </div>
      </div>

      {/* 정책 + 페르소나 2분할 */}
      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[var(--w-line-normal)]">
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-[11px] uppercase tracking-[0.04em] text-[var(--w-fg-alternative)]">정책</span>
          {filledSections.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {filledSections.map((s) => (
                <span
                  key={s.type}
                  className="inline-flex items-center px-2 py-0.5 rounded-full font-medium text-[11px]"
                  style={{
                    background: `color-mix(in srgb, ${SECTION_ACCENT[s.type]} 12%, transparent)`,
                    color: SECTION_ACCENT[s.type],
                  }}
                >
                  {SOP_SECTION_LABEL[s.type]}
                </span>
              ))}
            </div>
          ) : (
            <span className="font-medium text-[12px] text-[var(--w-fg-alternative)] italic">미설정</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-[11px] uppercase tracking-[0.04em] text-[var(--w-fg-alternative)]">페르소나</span>
          {personas.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {personas.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-full font-medium text-[11px] bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)]"
                  >
                    {personaChipLabel(p)}
                  </span>
              ))}
            </div>
          ) : (
            <span className="font-medium text-[12px] text-[var(--w-fg-alternative)] italic">미설정</span>
          )}
        </div>
      </div>

      {/* 액션 */}
      <div
        className="flex items-center gap-1.5 pt-3 border-t border-[var(--w-line-normal)]"
        onClick={(e) => e.stopPropagation()}
      >
        {!profile.isDefault && (
          <button
            type="button"
            className="font-medium text-[12px] text-[var(--w-fg-neutral)] hover:text-[var(--w-primary-normal)] transition-colors"
            onClick={(e) => { e.preventDefault(); onSetDefault(profile.id); }}
          >
            기본값으로 설정
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <Link
            href={`/brand-profile/${profile.id}/edit`}
            className="font-medium text-[12px] text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            수정
          </Link>
          <button
            type="button"
            className="font-medium text-[12px] text-[var(--w-fg-neutral)] hover:text-[var(--w-status-negative)] transition-colors"
            onClick={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
          >
            삭제
          </button>
        </div>
      </div>

      {confirmOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmModal
            title={`"${profile.name}" 프로필을 삭제할까요?`}
            desc="연결된 페르소나도 함께 지워져요. 되돌릴 수 없어요."
            confirmLabel="삭제"
            tone="danger"
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmOpen(false);
              onDelete(profile.id);
            }}
          />
        </div>
      )}
    </div>
  );
}

function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded-2xl border border-dashed border-[var(--w-line-normal)] bg-transparent p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-[border-color,background] duration-[120ms] hover:border-[var(--w-primary-normal)] hover:bg-[color-mix(in_srgb,var(--w-primary-normal)_4%,transparent)] min-h-[120px]"
      onClick={onClick}
    >
      <Icon name="plus" size={20} style={{ color: "var(--w-fg-alternative)" }} />
      <span className="font-semibold text-[13px] text-[var(--w-fg-neutral)]">새 프로필 추가</span>
    </button>
  );
}

export default function BrandProfilePage() {
  const router = useRouter();
  const showToast = useToast();
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;
  useEffect(() => {
    if (browseMode) seedDemoIfEmpty();
  }, [browseMode]);
  const { profiles, saveProfile, deleteProfile, setDefault } = useBrandProfilesStorage();
  const allPersonas = readPersonas();

  const openNew = () => {
    const id = crypto.randomUUID();
    saveProfile({ id, name: "새 프로필", isDefault: profiles.length === 0 });
    router.push(`/brand-profile/${id}/edit`);
  };

  const handleDelete = (id: string) => {
    deleteProfile(id);
    showToast("삭제했어요");
  };

  const handleSetDefault = (id: string) => {
    setDefault(id);
    showToast("기본값으로 설정됐어요");
  };

  return (
    <div className="px-12 py-9 pb-16 max-w-[900px] w-full mx-auto flex flex-col gap-7">
      <div className="flex justify-between items-end gap-6">
        <div>
          <span className="font-semibold text-[11px] leading-[1.45] uppercase tracking-[0.04em] text-[var(--w-fg-neutral)]">
            브랜드 & 정책
          </span>
          <h1
            className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]"
            style={{ marginTop: 4 }}
          >
            브랜드 프로필
          </h1>
          <p className="mt-1.5 mb-0 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-neutral)] tracking-[0.004em]">
            제품군·브랜드별로 프로필을 만들어두면 광고 만들기 시 원하는 프로필을 바로 적용할 수 있어요
          </p>
        </div>
        <Button variant="primary" type="button" onClick={openNew}>
          <Icon name="plus" size={14} /> 새 프로필
        </Button>
      </div>

      {profiles.length === 0 ? (
        <Card variant="lg">
          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
            <div className="w-10 h-10 rounded-xl bg-[var(--w-bg-alternative)] flex items-center justify-center">
              <Icon name="sparkles" size={20} style={{ color: "var(--w-fg-alternative)" }} />
            </div>
            <div>
              <p className="m-0 font-semibold text-[15px] text-[var(--w-fg-strong)]">
                아직 브랜드 프로필이 없어요
              </p>
              <p className="mt-1 mb-0 font-medium text-[13px] text-[var(--w-fg-neutral)]">
                프로필을 만들면 광고 만들기에서 자동으로 사용돼요
              </p>
            </div>
            <Button variant="primary" type="button" onClick={openNew}>
              <Icon name="plus" size={14} /> 첫 번째 프로필 만들기
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {profiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              personas={allPersonas.filter((a) => a.brandProfileId === p.id)}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
            />
          ))}
          <AddCard onClick={openNew} />
        </div>
      )}
    </div>
  );
}
