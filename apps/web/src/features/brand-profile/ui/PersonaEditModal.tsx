"use client";

import { useState } from "react";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
import { Dialog, DialogContent, DialogTitle } from "@shared/ui/Dialog";
import type { PersonaEntry } from "../model/usePersonasStorage";

const INPUT_CLS =
  "w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]";

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed]);
    setInput("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          className={cn(INPUT_CLS, "flex-1")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); add(); }}}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-2 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] font-medium text-[13px] text-[var(--w-fg-neutral)] hover:bg-[var(--w-bg-neutral)] transition-colors"
        >
          추가
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--w-bg-neutral)] font-medium text-[13px] text-[var(--w-fg-strong)]"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="flex items-center text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]"
              >
                <Icon name="x" size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  brandProfileId: string;
  persona?: PersonaEntry;
  onSave: (p: PersonaEntry) => void;
  onClose: () => void;
}

type GenderMode = "ai" | "all" | "male" | "female";

function initGenderMode(genders?: number[]): GenderMode {
  if (genders == null) return "ai";
  if (genders.length === 0) return "all";
  return genders.includes(1) && !genders.includes(2) ? "male" : "female";
}

export default function PersonaEditModal({ brandProfileId, persona, onSave, onClose }: Props) {
  const [name, setName] = useState(persona?.name ?? "");
  // 연령·성별 — 명시 시 override, AI 자동(undefined)이면 Gemini 추천. 신규는 기본 AI 자동.
  const [ageAuto, setAgeAuto] = useState<boolean>(persona ? persona.ageMin == null : true);
  const [ageMin, setAgeMin] = useState<number>(persona?.ageMin ?? 18);
  const [ageMax, setAgeMax] = useState<number>(persona?.ageMax ?? 65);
  const [ageMinInput, setAgeMinInput] = useState(String(persona?.ageMin ?? 18));
  const [ageMaxInput, setAgeMaxInput] = useState(String(persona?.ageMax ?? 65));
  const [genderMode, setGenderMode] = useState<GenderMode>(initGenderMode(persona?.genders));
  const [location, setLocation] = useState<string[]>(persona?.location ?? []);
  const [interests, setInterests] = useState<string[]>(persona?.interests ?? []);
  const [customerDescription, setCustomerDescription] = useState(persona?.customerDescription ?? "");

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: persona?.id ?? `persona-${Date.now()}`,
      brandProfileId,
      name: name.trim(),
      ageMin: ageAuto ? undefined : ageMin,
      ageMax: ageAuto ? undefined : ageMax,
      genders: genderMode === "ai" ? undefined : genderMode === "all" ? [] : genderMode === "male" ? [1] : [2],
      location: location.length ? location : undefined,
      interests: interests.length ? interests : undefined,
      customerDescription: customerDescription.trim() || undefined,
    });
  };

  const GENDER_OPTIONS: { value: GenderMode; label: string }[] = [
    { value: "ai", label: "AI 추천" },
    { value: "all", label: "전체" },
    { value: "male", label: "남" },
    { value: "female", label: "여" },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{ width: 520 }}>
        <div className="flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <DialogTitle className="m-0 font-bold text-[18px] leading-[1.3] tracking-[-0.016em] text-[var(--w-fg-strong)]">
            {persona ? "페르소나 편집" : "페르소나 추가"}
          </DialogTitle>
          <button type="button" onClick={onClose} className="p-1 text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[14px] text-[var(--w-fg-strong)]">이름 <span className="text-red-500">*</span></label>
            <input
              className={INPUT_CLS}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 20대 여성 직장인"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-[14px] text-[var(--w-fg-strong)]">연령대</label>
              <button
                type="button"
                onClick={() => setAgeAuto((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border font-medium text-[12px] cursor-pointer transition-[background,border-color,color] duration-[120ms]",
                  ageAuto
                    ? "border-[var(--w-primary-normal)] bg-[var(--w-primary-soft)] text-[var(--w-primary-press)]"
                    : "border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[var(--w-fg-neutral)]",
                )}
              >
                <Icon name="sparkles" size={11} /> AI에게 맡기기
              </button>
            </div>
            {ageAuto ? (
              <p className="m-0 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">
                연령대를 비워두면 AI가 광고 내용을 보고 추천해요.
              </p>
            ) : (
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">최소</span>
                <div className="relative">
                  <input
                    type="number" min={18} max={65} value={ageMinInput}
                    onChange={(e) => setAgeMinInput(e.target.value)}
                    onBlur={() => {
                      const v = Math.max(18, Math.min(65, Number(ageMinInput) || 18));
                      const next = Math.min(v, ageMax);
                      setAgeMin(next);
                      setAgeMinInput(String(next));
                    }}
                    className="w-full px-[14px] py-3 pr-8 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-medium text-[13px] text-[var(--w-fg-neutral)] pointer-events-none">세</span>
                </div>
              </div>
              <span className="font-medium text-[13px] text-[var(--w-fg-neutral)] mt-5">~</span>
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">최대</span>
                <div className="relative">
                  <input
                    type="number" min={18} max={65} value={ageMaxInput}
                    onChange={(e) => setAgeMaxInput(e.target.value)}
                    onBlur={() => {
                      const v = Math.max(18, Math.min(65, Number(ageMaxInput) || 65));
                      const next = Math.max(v, ageMin);
                      setAgeMax(next);
                      setAgeMaxInput(String(next));
                    }}
                    className="w-full px-[14px] py-3 pr-8 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-medium text-[13px] text-[var(--w-fg-neutral)] pointer-events-none">세</span>
                </div>
              </div>
            </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[14px] text-[var(--w-fg-strong)]">성별</label>
            <div className="flex gap-2">
              {GENDER_OPTIONS.map(({ value, label }) => {
                const selected = genderMode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGenderMode(value)}
                    className={cn(
                      "inline-flex items-center gap-1 px-4 py-2 rounded-full border font-medium text-[13px] cursor-pointer transition-[background,border-color,color] duration-[120ms]",
                      selected
                        ? "border-[var(--w-fg-strong)] bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)]"
                        : "border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)]",
                    )}
                  >
                    {value === "ai" && <Icon name="sparkles" size={12} />}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[14px] text-[var(--w-fg-strong)]">관심사</label>
            <TagInput value={interests} onChange={setInterests} placeholder="예) 뷰티, 헬스케어 (Enter)" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[14px] text-[var(--w-fg-strong)]">지역</label>
            <TagInput value={location} onChange={setLocation} placeholder="예) 서울, 경기 (Enter)" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[14px] text-[var(--w-fg-strong)]">고객 설명</label>
            <p className="text-[12px] leading-[1.4] text-[var(--w-fg-alternative)] m-0">
              이 사람이 지금 어떤 상황인가요? 무엇을 참고 있나요?
            </p>
            <textarea
              className="w-full px-[14px] py-3 border border-[var(--w-line-normal)] rounded-xl bg-[var(--w-bg-elevated)] font-medium text-[14px] leading-[1.6] text-[var(--w-fg-strong)] outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--w-fg-alternative)] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] resize-y min-h-[72px]"
              value={customerDescription}
              onChange={(e) => setCustomerDescription(e.target.value)}
              placeholder="예) 피부 트러블에 민감한 20대 초반 여성. 성분 중심으로 구매 결정."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>취소</Button>
          <Button variant="primary" type="button" onClick={handleSave} disabled={!name.trim()}>
            {persona ? "저장" : "추가"}
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
