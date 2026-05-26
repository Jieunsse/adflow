"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { useToast } from "@shared/ui/Toast";
import { cn } from "@shared/lib/cn";
import { TONES } from "@entities/creative/options";
import {
  useBrandProfilesStorage,
  type BrandProfileEntry,
} from "@features/brand-profile/model/useBrandProfileStorage";

interface ProfileCardProps {
  profile: BrandProfileEntry;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

function ProfileCard({ profile, onDelete, onSetDefault }: ProfileCardProps) {
  const toneLabel = profile.tone ? TONES.find((t) => t.id === profile.tone)?.label : null;

  return (
    <Link
      href={`/brand-profile/${profile.id}`}
      className={cn(
        "relative rounded-2xl border bg-[var(--w-bg-elevated)] p-5 flex flex-col gap-3 transition-[border-color,box-shadow] duration-[120ms] hover:border-[var(--w-primary-normal)] hover:shadow-[0_0_0_4px_rgba(0,102,255,0.08)] no-underline text-inherit",
        profile.isDefault ? "border-[var(--w-primary-normal)]" : "border-[var(--w-line-normal)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <span className="font-bold text-[15px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)]">
            {profile.name}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {profile.isDefault && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--w-primary-soft)] font-semibold text-[11px] text-[var(--w-primary-normal)]">
                기본값
              </span>
            )}
            {toneLabel && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--w-bg-alternative)] font-medium text-[11px] text-[var(--w-fg-neutral)]">
                {toneLabel}
              </span>
            )}
          </div>
        </div>
        <Icon name="edit" size={14} style={{ color: "var(--w-fg-alternative)", flexShrink: 0, marginTop: 2 }} />
      </div>

      {profile.brandVoice && (
        <p className="m-0 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-normal)] line-clamp-2">
          {profile.brandVoice}
        </p>
      )}

      <div
        className="flex items-center gap-1.5 mt-auto pt-2 border-t border-[var(--w-line-normal)]"
        onClick={(e) => e.preventDefault()}
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
        <button
          type="button"
          className="ml-auto font-medium text-[12px] text-[var(--w-fg-neutral)] hover:text-[var(--w-status-destructive)] transition-colors"
          onClick={(e) => {
            e.preventDefault();
            if (!window.confirm(`"${profile.name}" 프로필을 삭제할까요?`)) return;
            onDelete(profile.id);
          }}
        >
          삭제
        </button>
      </div>
    </Link>
  );
}

function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded-2xl border border-dashed border-[var(--w-line-normal)] bg-transparent p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-[border-color,background] duration-[120ms] hover:border-[var(--w-primary-normal)] hover:bg-[rgba(0,102,255,0.04)] min-h-[120px]"
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
  const { profiles, saveProfile, deleteProfile, setDefault } = useBrandProfilesStorage();

  const openNew = () => {
    const id = crypto.randomUUID();
    saveProfile({ id, name: "새 프로필", isDefault: profiles.length === 0 });
    router.push(`/brand-profile/${id}`);
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
        <div className="grid grid-cols-2 gap-4">
          {profiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
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
