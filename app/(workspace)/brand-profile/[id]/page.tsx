"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { useToast } from "@shared/ui/Toast";
import { cn } from "@shared/lib/cn";
import {
  useBrandProfilesStorage,
  type BrandProfileEntry,
} from "@features/brand-profile/model/useBrandProfileStorage";
import {
  usePersonasForProfile,
  type PersonaEntry,
} from "@features/brand-profile/model/usePersonasStorage";
import {
  isSectionFilled,
  type SopItemType,
  type SopSection,
} from "@features/sop/model/useSopStorage";
import { SOP_SECTION_ORDER } from "@features/sop/model/section-labels";
import SopCard from "@features/sop/ui/SopCard";
import SopEditModal from "@features/sop/ui/SopEditModal";
import PersonaCard from "@features/brand-profile/ui/PersonaCard";
import PersonaEditModal from "@features/brand-profile/ui/PersonaEditModal";

type Tab = "style" | "policy" | "persona";

const TEXTAREA_CLS =
  "w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.6] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] resize-y";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-semibold text-[14px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)]">
        {label}
      </label>
      {hint && (
        <p className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)] m-0">{hint}</p>
      )}
      {children}
    </div>
  );
}

function ReadField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-semibold text-[14px] leading-[1.3] tracking-[-0.008em] text-[var(--w-fg-strong)]">
        {label}
      </span>
      {value ? (
        <p className="m-0 font-medium text-[14px] leading-[1.6] tracking-[0.004em] text-[var(--w-fg-strong)] whitespace-pre-wrap">
          {value}
        </p>
      ) : (
        <p className="m-0 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-alternative)] italic">
          미입력
        </p>
      )}
    </div>
  );
}

export default function BrandProfileDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const showToast = useToast();
  const { data: session } = useSession();
  const isOwner = session?.role === "팀장";
  const { profiles, saveProfile } = useBrandProfilesStorage();
  const { personas, savePersona, deletePersona } = usePersonasForProfile(id);

  const [tab, setTab] = useState<Tab>("style");
  const [loaded, setLoaded] = useState(false);
  const [entry, setEntry] = useState<BrandProfileEntry | null>(null);
  const [editingType, setEditingType] = useState<SopItemType | null>(null);
  const [editingPersona, setEditingPersona] = useState<PersonaEntry | "new" | null>(null);

  const [name, setName] = useState("");
  const [tone, setTone] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [prohibitedWords, setProhibitedWords] = useState("");
  const [customerVoiceSummary, setCustomerVoiceSummary] = useState("");
  const [requiredPhrases, setRequiredPhrases] = useState("");
  const [requiredHashtags, setRequiredHashtags] = useState("");
  const [imageGuide, setImageGuide] = useState("");

  useEffect(() => {
    if (profiles.length === 0 && !loaded) return;
    const p = profiles.find((p) => p.id === id);
    if (!p) {
      router.replace("/brand-profile");
      return;
    }
    if (!loaded) {
      setName(p.name);
      setTone(p.tone ?? "");
      setBrandDescription(p.brandDescription ?? "");
      setBrandVoice(p.brandVoice ?? "");
      setProhibitedWords(p.prohibitedWords ?? "");
      setCustomerVoiceSummary(p.customerVoiceSummary ?? "");
      setRequiredPhrases(p.requiredPhrases ?? "");
      setRequiredHashtags(p.requiredHashtags ?? "");
      setImageGuide(p.imageGuide ?? "");
      setLoaded(true);
    }
    setEntry(p);
  }, [profiles, id, loaded, router]);

  const saveStyle = () => {
    if (!entry) return;
    const updated: BrandProfileEntry = {
      ...entry,
      name: name.trim() || "새 프로필",
      tone: tone || undefined,
      brandDescription: brandDescription.trim() || undefined,
      brandVoice: brandVoice.trim() || undefined,
      prohibitedWords: prohibitedWords.trim() || undefined,
      customerVoiceSummary: customerVoiceSummary.trim() || undefined,
      requiredPhrases: requiredPhrases.trim() || undefined,
      requiredHashtags: requiredHashtags.trim() || undefined,
      imageGuide: imageGuide.trim() || undefined,
    };
    saveProfile(updated);
    setEntry(updated);
    showToast("저장됐어요");
  };

  const handleSectionSave = (section: SopSection) => {
    if (!entry) return;
    const others = (entry.policy ?? []).filter((s) => s.type !== section.type);
    const next = isSectionFilled(section) ? [...others, section] : others;
    const updated = { ...entry, policy: next };
    saveProfile(updated);
    setEntry(updated);
    setEditingType(null);
    showToast("정책이 저장됐어요");
  };

  const handleSectionClear = () => {
    if (!entry || !editingType) return;
    const next = (entry.policy ?? []).filter((s) => s.type !== editingType);
    const updated = { ...entry, policy: next };
    saveProfile(updated);
    setEntry(updated);
    setEditingType(null);
  };

  if (!loaded) {
    return <div className="px-12 py-9 text-[var(--w-fg-neutral)]">불러오는 중…</div>;
  }
  if (!entry) return null;

  const policy = entry.policy ?? [];

  return (
    <div className="px-12 py-9 pb-16 max-w-[900px] w-full mx-auto flex flex-col gap-7">
      <div>
        <Link
          href="/brand-profile"
          className="inline-flex items-center gap-1.5 font-medium text-[12.5px] text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] transition-colors mb-3 no-underline"
        >
          <Icon name="arrow-left" size={13} /> 브랜드 프로필 목록
        </Link>
        <div className="flex items-end justify-between gap-6">
          <div>
            <span className="font-semibold text-[11px] leading-[1.45] uppercase tracking-[0.04em] text-[var(--w-fg-neutral)]">
              브랜드 & 정책
            </span>
            <h1
              className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]"
              style={{ marginTop: 4 }}
            >
              {entry.name}
            </h1>
          </div>
          {entry.isDefault && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[var(--w-primary-soft)] font-semibold text-[12px] text-[var(--w-primary-normal)]">
              기본값
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-[var(--w-line-normal)]" style={{ marginBottom: -16 }}>
        {(["style", "policy", "persona"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 font-semibold text-[13.5px] leading-none border-none bg-transparent cursor-pointer border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-[var(--w-primary-normal)] text-[var(--w-primary-press)]"
                : "border-transparent text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]"
            )}
          >
            {t === "style" ? "스타일" : t === "policy" ? "정책" : "페르소나"}
          </button>
        ))}
      </div>

      {tab === "style" && !isOwner && (
        <div className="flex flex-col gap-5 pt-4">
          <ReadField label="프로필 이름" value={name} />
          <ReadField label="광고 느낌 (Tone)" value={tone} />
          <ReadField label="브랜드 설명" value={brandDescription} />
          <ReadField label="브랜드 보이스 (Brand Voice)" value={brandVoice} />
          <ReadField label="금지어" value={prohibitedWords} />
          <ReadField label="필수 문구" value={requiredPhrases} />
          <ReadField label="필수 해시태그" value={requiredHashtags} />
          <ReadField label="이미지 가이드" value={imageGuide} />
          <ReadField label="고객 목소리 요약 (Customer Voice)" value={customerVoiceSummary} />
        </div>
      )}

      {tab === "style" && isOwner && (
        <div className="flex flex-col gap-5 pt-4">
          <Field label="프로필 이름">
            <input
              className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) A제품군, 브랜드명"
            />
          </Field>

          <Field label="광고 느낌 (Tone)" hint="광고 만들기에서 기본 톤으로 적용돼요. AI 카피 생성에 반영됩니다.">
            <input
              className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="예) 친근하고 유머러스하게, 전문적이고 신뢰감 있게"
            />
          </Field>

          <Field
            label="브랜드 설명"
            hint="제품·서비스 소개, 타겟, 강점을 적어주세요. AI 카피 생성의 베이스가 돼요."
          >
            <textarea
              className={cn(TEXTAREA_CLS, "min-h-[96px]")}
              value={brandDescription}
              onChange={(e) => setBrandDescription(e.target.value)}
              placeholder={"예) 20대 여성을 위한 비건 스킨케어 브랜드 '그린루틴'.\n대표 제품은 수분크림으로 자극 없는 성분이 강점이에요."}
            />
          </Field>

          <Field
            label="브랜드 보이스 (Brand Voice)"
            hint="브랜드가 말하는 방식·어조 가이드. 카피 문체에 반영돼요."
          >
            <textarea
              className={cn(TEXTAREA_CLS, "min-h-[64px]")}
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              placeholder="예) 친근하고 솔직하게. 과장 없이 담백하게 이야기해요."
            />
          </Field>

          <Field label="금지어" hint="광고 카피에 절대 쓰면 안 되는 단어·표현. 줄바꿈 또는 쉼표로 구분.">
            <textarea
              className={cn(TEXTAREA_CLS, "min-h-[64px]")}
              value={prohibitedWords}
              onChange={(e) => setProhibitedWords(e.target.value)}
              placeholder="예) 최고, 1위, 보장"
            />
          </Field>

          <Field label="필수 문구" hint="광고에 반드시 포함해야 하는 문구. 줄바꿈으로 구분.">
            <textarea
              className={cn(TEXTAREA_CLS, "min-h-[64px]")}
              value={requiredPhrases}
              onChange={(e) => setRequiredPhrases(e.target.value)}
              placeholder={"예) 지금 가입하면 30일 무료\n전문가 상담 가능"}
            />
          </Field>

          <Field label="필수 해시태그" hint="Instagram 광고에 포함할 해시태그. 줄바꿈 또는 쉼표로 구분.">
            <textarea
              className={cn(TEXTAREA_CLS, "min-h-[56px]")}
              value={requiredHashtags}
              onChange={(e) => setRequiredHashtags(e.target.value)}
              placeholder={"예) #그린루틴 #비건스킨케어"}
            />
          </Field>

          <Field label="이미지 가이드" hint="배경색·로고 위치·인물 정책 등 이미지 생성 규칙.">
            <textarea
              className={cn(TEXTAREA_CLS, "min-h-[64px]")}
              value={imageGuide}
              onChange={(e) => setImageGuide(e.target.value)}
              placeholder="예) 배경은 흰색 또는 연한 베이지. 로고는 우측 하단."
            />
          </Field>

          <Field
            label="고객 목소리 요약 (Customer Voice)"
            hint="주요 고객 리뷰·VOC 요약. AI가 카피 작성 시 고객 언어를 반영해요."
          >
            <textarea
              className={cn(TEXTAREA_CLS, "min-h-[72px]")}
              value={customerVoiceSummary}
              onChange={(e) => setCustomerVoiceSummary(e.target.value)}
              placeholder="예) '바르고 나면 촉촉해요', '향이 자극적이지 않아서 좋아요'라는 리뷰가 많아요."
            />
          </Field>

          <div className="flex justify-end pt-2">
            <Button variant="primary" type="button" onClick={saveStyle}>
              저장
            </Button>
          </div>
        </div>
      )}

      {tab === "policy" && (
        <div className="flex flex-col gap-4 pt-4">
          <p className="m-0 font-medium text-[13.5px] leading-[1.5] text-[var(--w-fg-neutral)]">
            광고·콘텐츠 제작 시 따라야 하는 가드레일을 설정하세요.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {SOP_SECTION_ORDER.map((type) => {
              const section = policy.find((s) => s.type === type);
              return (
                <SopCard
                  key={type}
                  type={type}
                  section={section}
                  canEdit={isOwner}
                  onEdit={() => setEditingType(type)}
                />
              );
            })}
          </div>
        </div>
      )}

      {tab === "persona" && (
        <div className="flex flex-col gap-4 pt-4">
          <p className="m-0 font-medium text-[13.5px] leading-[1.5] text-[var(--w-fg-neutral)]">
            이 브랜드 프로필의 타겟 고객 페르소나를 정의하세요. AI 카피 생성 시 활용돼요.
          </p>
          {personas.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {personas.map((p) => (
                <PersonaCard
                  key={p.id}
                  persona={p}
                  canEdit={isOwner}
                  onEdit={() => isOwner && setEditingPersona(p)}
                  onDelete={() => deletePersona(p.id)}
                />
              ))}
            </div>
          ) : (
            !isOwner && (
              <p className="m-0 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-alternative)] italic">
                아직 정의된 페르소나가 없어요
              </p>
            )
          )}
          {isOwner && (
            <div>
              <Button variant="secondary" type="button" onClick={() => setEditingPersona("new")}>
                + 페르소나 추가
              </Button>
            </div>
          )}
        </div>
      )}

      {editingType && (
        <SopEditModal
          type={editingType}
          section={policy.find((s) => s.type === editingType)}
          onSave={handleSectionSave}
          onClear={handleSectionClear}
          onClose={() => setEditingType(null)}
        />
      )}

      {editingPersona && (
        <PersonaEditModal
          brandProfileId={id}
          persona={editingPersona === "new" ? undefined : editingPersona}
          onSave={(p) => { savePersona(p); setEditingPersona(null); }}
          onClose={() => setEditingPersona(null)}
        />
      )}
    </div>
  );
}
