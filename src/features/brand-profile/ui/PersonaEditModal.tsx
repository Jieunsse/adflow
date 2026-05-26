"use client";

import { useEffect, useState } from "react";
import { Button } from "@shared/ui/Button";
import Icon from "@shared/ui/Icon";
import { cn } from "@shared/lib/cn";
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
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); }}}
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
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--w-bg-neutral)] font-medium text-[12.5px] text-[var(--w-fg-strong)]"
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

export default function PersonaEditModal({ brandProfileId, persona, onSave, onClose }: Props) {
  const [name, setName] = useState(persona?.name ?? "");
  const [ageMin, setAgeMin] = useState<number>(persona?.ageMin ?? 18);
  const [ageMax, setAgeMax] = useState<number>(persona?.ageMax ?? 65);
  const [genders, setGenders] = useState<number[]>(persona?.genders ?? []);
  const [location, setLocation] = useState<string[]>(persona?.location ?? []);
  const [interests, setInterests] = useState<string[]>(persona?.interests ?? []);
  const [customerDescription, setCustomerDescription] = useState(persona?.customerDescription ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleGender = (g: number) => {
    setGenders((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: persona?.id ?? `persona-${Date.now()}`,
      brandProfileId,
      name: name.trim(),
      ageMin,
      ageMax,
      genders,
      location: location.length ? location : undefined,
      interests: interests.length ? interests : undefined,
      customerDescription: customerDescription.trim() || undefined,
    });
  };

  const GENDER_OPTIONS = [{ value: 0, label: "전체" }, { value: 1, label: "남" }, { value: 2, label: "여" }];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-[var(--w-bg-elevated)] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="m-0 font-bold text-[18px] leading-[1.3] tracking-[-0.016em] text-[var(--w-fg-strong)]">
            {persona ? "페르소나 편집" : "페르소나 추가"}
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[13.5px] text-[var(--w-fg-strong)]">이름 <span className="text-red-500">*</span></label>
            <input
              className={INPUT_CLS}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 20대 여성 직장인"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[13.5px] text-[var(--w-fg-strong)]">연령대</label>
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">최소 {ageMin}세</span>
                <input type="range" min={18} max={65} value={ageMin} onChange={(e) => {
                  const v = Number(e.target.value);
                  setAgeMin(v);
                  if (v > ageMax) setAgeMax(v);
                }} className="w-full" />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">최대 {ageMax}세</span>
                <input type="range" min={18} max={65} value={ageMax} onChange={(e) => {
                  const v = Number(e.target.value);
                  setAgeMax(v);
                  if (v < ageMin) setAgeMin(v);
                }} className="w-full" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[13.5px] text-[var(--w-fg-strong)]">성별</label>
            <div className="flex gap-2">
              {GENDER_OPTIONS.map(({ value, label }) => {
                const selected = value === 0 ? genders.length === 0 : genders.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => value === 0 ? setGenders([]) : toggleGender(value)}
                    className={cn(
                      "px-4 py-2 rounded-full border font-medium text-[13px] cursor-pointer transition-[background,border-color,color] duration-[120ms]",
                      selected
                        ? "border-[var(--w-fg-strong)] bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)]"
                        : "border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)]",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[13.5px] text-[var(--w-fg-strong)]">관심사</label>
            <TagInput value={interests} onChange={setInterests} placeholder="예) 뷰티, 헬스케어 (Enter)" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[13.5px] text-[var(--w-fg-strong)]">지역</label>
            <TagInput value={location} onChange={setLocation} placeholder="예) 서울, 경기 (Enter)" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[13.5px] text-[var(--w-fg-strong)]">고객 설명</label>
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
    </div>
  );
}
