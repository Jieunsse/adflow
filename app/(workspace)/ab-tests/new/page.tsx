"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Chip } from "@shared/ui/Chip";
import { MOCK_CAMPAIGN_SUMMARIES } from "@/lib/mock-campaigns";
import type { IconName } from "@shared/ui/Icon";

type Method = "existing" | "new";
type AxisType = "headline" | "primary_text" | "image";
type Step = "method" | "type" | "config";

const AXIS_INFO: { id: AxisType; label: string; desc: string; icon: IconName }[] = [
  {
    id: "headline",
    label: "헤드라인",
    icon: "doc",
    desc: "광고 제목 문구 두 가지를 비교해요. 어떤 제목이 클릭을 더 유도하는지 파악할 수 있어요.",
  },
  {
    id: "primary_text",
    label: "카피 문구",
    icon: "message",
    desc: "광고 본문 문구 두 가지를 비교해요. 설득력 있는 메시지를 찾을 때 효과적이에요.",
  },
  {
    id: "image",
    label: "이미지",
    icon: "image",
    desc: "광고 이미지 두 가지를 비교해요. 시각적 임팩트가 성과에 미치는 영향을 측정해요.",
  },
];

const STEP_LABELS: Record<Step, string> = {
  method: "방식 선택",
  type: "테스트 종류",
  config: "세부 설정",
};
const STEP_ORDER: Step[] = ["method", "type", "config"];

export default function AbTestNewPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<Method | null>(null);
  const [axis, setAxis] = useState<AxisType | null>(null);

  const stepIdx = STEP_ORDER.indexOf(step);

  const goBack = () => {
    if (step === "config") setStep("type");
    else if (step === "type") setStep("method");
    else router.push("/ab-tests");
  };

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label="A/B 테스트 생성">
      {/* 헤더 */}
      <button
        type="button"
        onClick={goBack}
        className="bg-transparent border-none p-0 cursor-pointer inline-flex items-center gap-1.5 font-semibold text-[12.5px] leading-none text-[var(--w-fg-neutral)] hover:underline mb-1"
      >
        <Icon name="arrow-left" size={13} /> {step === "method" ? "A/B 테스트" : STEP_LABELS[STEP_ORDER[stepIdx - 1]]}
      </button>

      <div className="flex justify-between items-end gap-6 mt-1 mb-6">
        <div>
          <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]">새 A/B 테스트</h1>
          <p className="font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-neutral)] mt-1.5 mb-0">두 가지 소재를 비교해 더 효과적인 광고를 찾아요</p>
        </div>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-0 mb-8">
        {STEP_ORDER.map((s, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <div key={s} className="flex items-center gap-0">
              <div className="flex items-center gap-2">
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
                  background: done ? "var(--w-primary-normal)" : active ? "var(--w-primary-soft)" : "var(--w-bg-alternative)",
                  border: active ? "2px solid var(--w-primary-normal)" : done ? "none" : "2px solid var(--w-line-normal)",
                  color: done ? "#fff" : active ? "var(--w-primary-press)" : "var(--w-fg-alternative)",
                  transition: "all 200ms",
                }} className="font-bold text-[12px] leading-none">
                  {done ? <Icon name="check" size={13} /> : i + 1}
                </div>
                <span className="font-semibold text-[13px] leading-none" style={{
                  color: active ? "var(--w-fg-strong)" : done ? "var(--w-primary-normal)" : "var(--w-fg-alternative)",
                }}>
                  {STEP_LABELS[s]}
                </span>
              </div>
              {i < STEP_ORDER.length - 1 && (
                <div style={{ width: 32, height: 2, background: done ? "var(--w-primary-normal)" : "var(--w-line-normal)", margin: "0 8px", transition: "background 200ms" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* STEP 1: 방식 선택 */}
      {step === "method" && (
        <MethodStep
          onSelect={(m) => {
            setMethod(m);
            if (m === "new") setStep("type");
            else setStep("type");
          }}
        />
      )}

      {/* STEP 2: 테스트 종류 */}
      {step === "type" && (
        <TypeStep
          method={method!}
          onSelect={(a) => {
            setAxis(a);
            if (method === "new") {
              // 새로 만들기는 config 대신 안내 화면
              setStep("config");
            } else {
              setStep("config");
            }
          }}
        />
      )}

      {/* STEP 3: 세부 설정 */}
      {step === "config" && axis && method && (
        <ConfigStep
          method={method}
          axis={axis}
          onBack={() => setStep("type")}
        />
      )}
    </div>
  );
}

/* ─── STEP 1: 방식 선택 ─────────────────────────────────── */

function MethodStep({ onSelect }: { onSelect: (m: Method) => void }) {
  return (
    <div>
      <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)] mb-3.5">
        어떤 방식으로 A/B 테스트를 진행할까요?
      </div>
      <div className="grid grid-cols-2 gap-4">
        <MethodCard
          icon="folder"
          title="기존에 올라가있는 광고로 진행"
          desc="이미 집행 중이거나 저장된 두 광고의 성과를 비교해요. 기존 광고를 A안·B안으로 지정합니다."
          tag="간편 시작"
          tagColor="var(--w-status-positive)"
          onClick={() => onSelect("existing")}
        />
        <MethodCard
          icon="sparkles"
          title="새로 광고 만들면서 시작"
          desc="광고 만들기 플로우에서 소재를 직접 작성하고 A/B 설정까지 한 번에 완료해요."
          tag="추천"
          tagColor="var(--w-primary-normal)"
          onClick={() => onSelect("new")}
        />
      </div>
    </div>
  );
}

function MethodCard({ icon, title, desc, tag, tagColor, onClick }: {
  icon: IconName; title: string; desc: string; tag: string; tagColor: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-2xl text-left cursor-pointer transition-[border-color] duration-[160ms] flex flex-col gap-3.5 p-6 pr-5"
      style={{ border: "1.5px solid var(--w-line-alternative)" }}
    >
      <div className="flex items-center justify-between">
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--w-primary-soft)", color: "var(--w-primary-normal)", display: "grid", placeItems: "center" }}>
          <Icon name={icon} size={22} />
        </div>
        <span className="font-bold text-[11.5px] leading-none" style={{ color: tagColor, background: `color-mix(in srgb, ${tagColor} 12%, transparent)`, padding: "4px 9px", borderRadius: 999, border: `1px solid color-mix(in srgb, ${tagColor} 30%, transparent)` }}>
          {tag}
        </span>
      </div>
      <div>
        <div className="font-bold text-[15px] leading-[1.4] text-[var(--w-fg-strong)] mb-1.5">{title}</div>
        <p className="font-medium text-[13px] leading-[1.6] text-[var(--w-fg-neutral)] m-0">{desc}</p>
      </div>
      <div className="flex items-center gap-1 font-semibold text-[13px] leading-none text-[var(--w-primary-normal)] mt-auto">
        선택하기 <Icon name="arrow-right" size={14} />
      </div>
    </button>
  );
}

/* ─── STEP 2: 테스트 종류 ────────────────────────────────── */

function TypeStep({ method, onSelect }: { method: Method; onSelect: (a: AxisType) => void }) {
  return (
    <div>
      <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)] mb-1">
        어떤 요소를 비교할까요?
      </div>
      <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] m-0 mb-5">
        {method === "new"
          ? "광고 만들기에서 해당 요소를 A안·B안으로 설정하게 돼요."
          : "기존 광고 두 개에서 비교할 요소를 선택해요."}
      </p>
      <div className="flex flex-col gap-3">
        {AXIS_INFO.map((a) => (
          <AxisCard key={a.id} info={a} onClick={() => onSelect(a.id)} />
        ))}
      </div>
    </div>
  );
}

function AxisCard({ info, onClick }: { info: typeof AXIS_INFO[0]; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-2xl text-left cursor-pointer transition-[border-color] duration-[160ms] flex items-center gap-4 py-[18px] px-5"
      style={{ border: "1.5px solid var(--w-line-alternative)" }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--w-primary-soft)", color: "var(--w-primary-normal)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
        <Icon name={info.icon} size={22} />
      </div>
      <div className="flex-1">
        <div className="font-bold text-[15px] leading-[1.3] text-[var(--w-fg-strong)] mb-1">{info.label}</div>
        <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] m-0">{info.desc}</p>
      </div>
      <Icon name="arrow-right" size={16} style={{ color: "var(--w-fg-alternative)", flex: "0 0 auto" }} />
    </button>
  );
}

/* ─── AI 생성 패널 ───────────────────────────────────────── */

type AiGenState = "idle" | "loading" | "done" | "error";

function AiGeneratePanel({ axis, onSelect }: { axis: "headline" | "primary_text"; onSelect: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState<"warm" | "pro" | "trendy">("warm");
  const [genState, setGenState] = useState<AiGenState>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [errMsg, setErrMsg] = useState("");

  const TONE_LABELS = { warm: "감성적", pro: "전문적", trendy: "트렌디" } as const;

  async function generate() {
    if (!brief.trim()) return;
    setGenState("loading");
    setErrMsg("");
    try {
      const res = await fetch("/api/generate-creative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: brief, target: "광고 타겟 고객", tone, outcome: "traffic" }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSuggestions(axis === "headline" ? data.headlines : data.primaryTexts);
      setGenState("done");
    } catch {
      setErrMsg("생성에 실패했어요. 잠시 후 다시 시도해주세요.");
      setGenState("error");
    }
  }

  return (
    <div className="mt-2.5">
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[var(--w-accent-violet)]"
      >
        <Icon name="sparkles" size={13} /> AI로 B안 생성
      </Button>

      {open && (
        <div className="mt-2.5 p-[14px_16px] rounded-[10px] bg-[var(--w-primary-soft)] border border-[var(--w-primary-weak)]">
          <div className="font-semibold text-[12.5px] leading-[1.3] text-[var(--w-fg-strong)] mb-2">
            제품/서비스 한 줄 설명
          </div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="예) 20대 여성을 위한 비건 스킨케어 브랜드"
            rows={2}
            className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-3 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] tracking-[0.004em] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)] resize-none"
            style={{ padding: "8px 10px", borderRadius: 8, fontSize: 13 }}
          />
          <div className="flex gap-1.5 my-2.5">
            {(["warm", "pro", "trendy"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                  tone === t
                    ? "bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] border border-[var(--w-primary-normal)]"
                    : "bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)] border border-[var(--w-line-alternative)]"
                }`}
              >
                {TONE_LABELS[t]}
              </button>
            ))}
          </div>
          <Button
            variant="primary"
            size="sm"
            type="button"
            disabled={!brief.trim() || genState === "loading"}
            onClick={generate}
            className="w-full"
          >
            {genState === "loading"
              ? <><Icon name="spinner" size={13} spin /> 생성 중…</>
              : <><Icon name="sparkles" size={13} /> 생성하기</>}
          </Button>

          {genState === "error" && (
            <p className="font-medium text-[12px] leading-[1.3] text-[var(--w-status-negative)] mt-2 mb-0">{errMsg}</p>
          )}

          {genState === "done" && suggestions.length > 0 && (
            <div className="mt-2.5">
              <div className="font-semibold text-[12px] leading-[1.3] text-[var(--w-fg-neutral)] mb-1.5">
                선택하면 B안에 입력돼요
              </div>
              <div className="flex flex-col gap-1.5">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { onSelect(s); setOpen(false); }}
                    className="text-left py-2 px-3 rounded-lg border border-[var(--w-primary-weak)] bg-[var(--w-bg-elevated)] font-medium text-[13px] leading-[1.5] text-[var(--w-fg-strong)] cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── STEP 3: 세부 설정 ──────────────────────────────────── */

function ConfigStep({ method, axis, onBack }: { method: Method; axis: AxisType; onBack: () => void }) {
  if (method === "new") {
    return <NewGuide axis={axis} />;
  }
  return <ExistingConfig axis={axis} />;
}

/* 새로 만들기 — A안/B안 직접 입력 + AI 생성 */
function NewGuide({ axis }: { axis: AxisType }) {
  const router = useRouter();
  const axisInfo = AXIS_INFO.find((a) => a.id === axis)!;
  const [variantA, setVariantA] = useState("");
  const [variantB, setVariantB] = useState("");

  if (axis === "image") {
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-5">
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--w-primary-soft)", color: "var(--w-primary-normal)", display: "grid", placeItems: "center" }}>
            <Icon name={axisInfo.icon} size={20} />
          </div>
          <div>
            <div className="font-bold text-[15px] leading-[1.3] text-[var(--w-fg-strong)]">이미지 A/B 테스트</div>
            <div className="font-medium text-[12.5px] leading-[1.3] text-[var(--w-fg-neutral)] mt-0.5">광고 만들기에서 이미지를 선택한 뒤 설정할 수 있어요</div>
          </div>
        </div>
        <div className="p-3 px-4 rounded-[10px] bg-[var(--w-primary-soft)] mb-4 font-medium text-[13px] leading-[1.5] text-[var(--w-primary-press)]">
          STEP 01에서 AI 이미지 3장 생성 → STEP 02에서 "A/B 시험으로 집행" 체크 → 이미지 탭 선택 → A안·B안 고르기
        </div>
        <Button variant="primary" type="button" onClick={() => router.push("/create")} className="w-full">
          <Icon name="sparkles" size={15} /> 광고 만들기로 이동
        </Button>
      </div>
    );
  }

  const isHeadline = axis === "headline";
  const aPlaceholder = isHeadline ? "현재 사용 중인 헤드라인을 입력해주세요" : "현재 사용 중인 광고 문구를 입력해주세요";
  const bPlaceholder = isHeadline ? "비교할 헤드라인을 입력해주세요" : "비교할 광고 문구를 입력해주세요";

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-5">
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--w-primary-soft)", color: "var(--w-primary-normal)", display: "grid", placeItems: "center" }}>
          <Icon name={axisInfo.icon} size={20} />
        </div>
        <div>
          <div className="font-bold text-[15px] leading-[1.3] text-[var(--w-fg-strong)]">{axisInfo.label} A/B 테스트</div>
          <div className="font-medium text-[12.5px] leading-[1.3] text-[var(--w-fg-neutral)] mt-0.5">A안과 B안을 입력하거나 AI로 생성해요</div>
        </div>
      </div>

      {/* A안 */}
      <div className="mb-3 p-[14px_16px] rounded-xl border-[1.5px] border-[var(--w-line-normal)] bg-[var(--w-bg-normal)]">
        <div className="flex items-center gap-2 mb-2">
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--w-bg-alternative)", border: "1.5px solid var(--w-line-normal)", color: "var(--w-fg-neutral)", display: "grid", placeItems: "center" }} className="font-bold text-[11px] leading-none">A</span>
          <span className="font-semibold text-[12.5px] leading-none text-[var(--w-fg-neutral)]">A안 — 기준 소재</span>
        </div>
        {isHeadline ? (
          <input type="text" value={variantA} onChange={(e) => setVariantA(e.target.value)} placeholder={aPlaceholder}
            className="w-full bg-transparent border-none p-0 outline-none font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]" />
        ) : (
          <textarea value={variantA} onChange={(e) => setVariantA(e.target.value)} placeholder={aPlaceholder} rows={3}
            className="w-full bg-transparent border-none p-0 outline-none font-medium text-[13px] leading-[1.55] text-[var(--w-fg-strong)] resize-y" />
        )}
      </div>

      {/* B안 */}
      <div className="p-[14px_16px] rounded-xl border-[1.5px] border-[var(--w-primary-normal)] bg-[var(--w-bg-normal)]">
        <div className="flex items-center gap-2 mb-2">
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--w-primary-soft)", border: "1.5px solid var(--w-primary-normal)", color: "var(--w-primary-press)", display: "grid", placeItems: "center" }} className="font-bold text-[11px] leading-none">B</span>
          <span className="font-semibold text-[12.5px] leading-none text-[var(--w-primary-press)]">B안 — 비교할 소재</span>
        </div>
        {isHeadline ? (
          <input type="text" value={variantB} onChange={(e) => setVariantB(e.target.value)} placeholder={bPlaceholder}
            className="w-full bg-transparent border-none p-0 outline-none font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]" />
        ) : (
          <textarea value={variantB} onChange={(e) => setVariantB(e.target.value)} placeholder={bPlaceholder} rows={3}
            className="w-full bg-transparent border-none p-0 outline-none font-medium text-[13px] leading-[1.55] text-[var(--w-fg-strong)] resize-y" />
        )}
      </div>
      <AiGeneratePanel axis={axis} onSelect={setVariantB} />

      <Button
        variant="primary"
        type="button"
        disabled={!variantA.trim() || !variantB.trim()}
        onClick={() => router.push("/ab-tests")}
        className="w-full"
        title={!variantA.trim() || !variantB.trim() ? "A안과 B안을 모두 입력해주세요" : undefined}
      >
        <Icon name="chart" size={14} /> A/B 테스트 시작
      </Button>
    </div>
  );
}

/* 기존 광고로 진행 설정 */
function ExistingConfig({ axis }: { axis: AxisType }) {
  const router = useRouter();
  const axisInfo = AXIS_INFO.find((a) => a.id === axis)!;
  const [campaignId, setCampaignId] = useState("");
  const [variantA, setVariantA] = useState("");
  const [variantB, setVariantB] = useState("");
  const [imageAUrl, setImageAUrl] = useState("");
  const [imageBUrl, setImageBUrl] = useState("");

  const campaign = MOCK_CAMPAIGN_SUMMARIES.find((c) => c.id === campaignId) ?? null;

  const handleCampaignSelect = (id: string) => {
    setCampaignId(id);
    const c = MOCK_CAMPAIGN_SUMMARIES.find((x) => x.id === id);
    if (!c) return;
    if (axis === "headline") setVariantA(c.headline ?? "");
    if (axis === "primary_text") setVariantA("예시 광고 카피 문구입니다. 지금 특가로 만나보세요!");
    if (axis === "image") setImageAUrl("https://placehold.co/400x400/eef2ff/6541f2?text=A안+이미지");
  };

  const canSubmit = campaignId && (
    axis === "image" ? (imageAUrl && imageBUrl) : (variantA && variantB)
  );

  return (
    <div className="flex flex-col gap-5">
      {/* 축 뱃지 */}
      <div className="flex items-center gap-2.5">
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--w-primary-soft)", color: "var(--w-primary-normal)", display: "grid", placeItems: "center" }}>
          <Icon name={axisInfo.icon} size={18} />
        </div>
        <div>
          <div className="font-bold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">{axisInfo.label} 비교</div>
          <div className="font-medium text-[12.5px] leading-[1.3] text-[var(--w-fg-neutral)] mt-0.5">{axisInfo.desc}</div>
        </div>
      </div>

      {/* 캠페인 선택 */}
      <div>
        <div className="font-semibold text-[13px] leading-[1.3] text-[var(--w-fg-strong)] mb-2">기준 캠페인 선택</div>
        <select
          value={campaignId}
          onChange={(e) => handleCampaignSelect(e.target.value)}
          className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-3 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] tracking-[0.004em] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)] appearance-none"
        >
          <option value="">캠페인을 선택해주세요</option>
          {MOCK_CAMPAIGN_SUMMARIES.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {campaign && (
          <div className="mt-2 flex items-center gap-1.5">
            <Chip
              variant={campaign.status === "live" ? "live" : campaign.status === "paused" ? "paused" : "neutral"}
              dot
            >
              {campaign.status === "live" ? "게재 중" : campaign.status === "paused" ? "일시정지" : campaign.status}
            </Chip>
            <span className="font-medium text-[12px] leading-none text-[var(--w-fg-neutral)]">{campaign.goal ?? "—"}</span>
          </div>
        )}
      </div>

      {/* A안 / B안 */}
      {axis === "image" ? (
        <ImageVariants
          imageAUrl={imageAUrl}
          imageBUrl={imageBUrl}
          onChangeA={setImageAUrl}
          onChangeB={setImageBUrl}
          locked={!campaignId}
        />
      ) : (
        <TextVariants
          axis={axis}
          variantA={variantA}
          variantB={variantB}
          onChangeA={setVariantA}
          onChangeB={setVariantB}
          locked={!campaignId}
        />
      )}

      {/* 안내 */}
      <div className="py-2.5 px-3.5 rounded-lg flex items-start gap-2" style={{ background: "rgba(255,146,0,0.08)", border: "1px solid rgba(255,146,0,0.22)" }}>
        <Icon name="info" size={14} style={{ color: "var(--w-status-cautionary)", flex: "0 0 auto", marginTop: 1 }} />
        <span className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)]">
          실제 광고 집행은 Meta 광고 관리자에서 이루어져요. AdFlow는 성과 데이터를 가져와 결과를 보여줘요.
        </span>
      </div>

      {/* 액션 */}
      <div className="flex gap-2.5">
        <Button
          variant="primary"
          type="button"
          disabled={!canSubmit}
          className="flex-1"
          title={canSubmit ? undefined : "캠페인과 A안·B안을 모두 입력해주세요"}
          onClick={() => router.push("/ab-tests")}
        >
          <Icon name="chart" size={14} /> A/B 테스트 시작
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={() => router.push("/ab-tests")}
        >
          취소
        </Button>
      </div>
    </div>
  );
}

function TextVariants({ axis, variantA, variantB, onChangeA, onChangeB, locked }: {
  axis: AxisType; variantA: string; variantB: string;
  onChangeA: (v: string) => void; onChangeB: (v: string) => void; locked: boolean;
}) {
  const isHeadline = axis === "headline";
  const placeholder = isHeadline ? "헤드라인 문구를 입력해주세요" : "카피 문구를 입력해주세요";

  return (
    <div className="flex flex-col gap-3">
      {/* A안 */}
      <div
        className="p-[14px_16px] rounded-xl border-[1.5px]"
        style={{
          border: "1.5px solid var(--w-line-normal)",
          background: locked ? "var(--w-bg-alternative)" : "var(--w-bg-normal)",
          opacity: locked ? 0.55 : 1,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--w-bg-alternative)", border: "1.5px solid var(--w-line-normal)", color: "var(--w-fg-neutral)", display: "grid", placeItems: "center" }} className="font-bold text-[11px] leading-none">A</span>
          <span className="font-semibold text-[12.5px] leading-none text-[var(--w-fg-neutral)]">A안 {locked ? "" : "— 현재 광고에서 자동으로 가져왔어요"}</span>
          {!locked && variantA && <Chip variant="neutral" className="ml-auto text-[11px]">자동 채움</Chip>}
        </div>
        {isHeadline ? (
          <input
            type="text"
            value={variantA}
            onChange={(e) => onChangeA(e.target.value)}
            placeholder={locked ? "캠페인을 먼저 선택해주세요" : placeholder}
            disabled={locked}
            className="w-full bg-transparent border-none p-0 outline-none font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]"
          />
        ) : (
          <textarea
            value={variantA}
            onChange={(e) => onChangeA(e.target.value)}
            placeholder={locked ? "캠페인을 먼저 선택해주세요" : placeholder}
            disabled={locked}
            rows={3}
            className="w-full bg-transparent border-none p-0 outline-none font-medium text-[13px] leading-[1.55] text-[var(--w-fg-strong)] resize-y"
          />
        )}
      </div>

      {/* B안 */}
      <div
        className="p-[14px_16px] rounded-xl border-[1.5px]"
        style={{
          border: "1.5px solid var(--w-primary-normal)",
          background: locked ? "var(--w-bg-alternative)" : "var(--w-bg-normal)",
          opacity: locked ? 0.55 : 1,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--w-primary-soft)", border: "1.5px solid var(--w-primary-normal)", color: "var(--w-primary-press)", display: "grid", placeItems: "center" }} className="font-bold text-[11px] leading-none">B</span>
          <span className="font-semibold text-[12.5px] leading-none text-[var(--w-primary-press)]">B안 — 비교할 내용을 입력해주세요</span>
        </div>
        {isHeadline ? (
          <input
            type="text"
            value={variantB}
            onChange={(e) => onChangeB(e.target.value)}
            placeholder={locked ? "캠페인을 먼저 선택해주세요" : placeholder}
            disabled={locked}
            className="w-full bg-transparent border-none p-0 outline-none font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]"
          />
        ) : (
          <textarea
            value={variantB}
            onChange={(e) => onChangeB(e.target.value)}
            placeholder={locked ? "캠페인을 먼저 선택해주세요" : placeholder}
            disabled={locked}
            rows={3}
            className="w-full bg-transparent border-none p-0 outline-none font-medium text-[13px] leading-[1.55] text-[var(--w-fg-strong)] resize-y"
          />
        )}
      </div>
      {!locked && <AiGeneratePanel axis={axis as "headline" | "primary_text"} onSelect={onChangeB} />}
    </div>
  );
}

function ImageVariants({ imageAUrl, imageBUrl, onChangeA, onChangeB, locked }: {
  imageAUrl: string; imageBUrl: string;
  onChangeA: (v: string) => void; onChangeB: (v: string) => void; locked: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-4" style={{ opacity: locked ? 0.55 : 1 }}>
      <ImageVariantBox
        label="A"
        labelColor={{ bg: "var(--w-bg-alternative)", border: "var(--w-line-normal)", text: "var(--w-fg-neutral)", accent: "var(--w-line-normal)" }}
        url={imageAUrl}
        placeholder="A안 이미지 URL 또는 업로드"
        onChange={onChangeA}
        locked={locked}
      />
      <ImageVariantBox
        label="B"
        labelColor={{ bg: "var(--w-primary-soft)", border: "var(--w-primary-normal)", text: "var(--w-primary-press)", accent: "var(--w-primary-normal)" }}
        url={imageBUrl}
        placeholder="B안 이미지 URL 또는 업로드"
        onChange={onChangeB}
        locked={locked}
      />
    </div>
  );
}

function ImageVariantBox({ label, labelColor, url, placeholder, onChange, locked }: {
  label: string;
  labelColor: { bg: string; border: string; text: string; accent: string };
  url: string;
  placeholder: string;
  onChange: (v: string) => void;
  locked: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: labelColor.bg, border: `1.5px solid ${labelColor.border}`, color: labelColor.text, display: "grid", placeItems: "center" }} className="font-bold text-[11px] leading-none">{label}</span>
        <span className="font-semibold text-[12.5px] leading-none" style={{ color: labelColor.text }}>{label}안</span>
      </div>
      {url ? (
        <div className="relative">
          <img src={url} alt={`${label}안`} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, border: `2px solid ${labelColor.accent}` }} />
          <button
            type="button"
            onClick={() => onChange("")}
            style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "#fff" }}
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      ) : (
        <label style={{
          width: "100%", aspectRatio: "1", borderRadius: 10,
          border: `2px dashed ${locked ? "var(--w-line-alternative)" : labelColor.accent}`,
          background: "var(--w-bg-alternative)", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 8, cursor: locked ? "not-allowed" : "pointer",
        }}>
          <Icon name="upload" size={22} style={{ color: locked ? "var(--w-fg-alternative)" : labelColor.text }} />
          <span className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)] text-center px-2">
            {locked ? "캠페인을 먼저\n선택해주세요" : "이미지 URL 입력\n또는 파일 업로드"}
          </span>
          <input
            type="text"
            placeholder="이미지 URL 입력"
            disabled={locked}
            onChange={(e) => onChange(e.target.value)}
            style={{ display: "none" }}
          />
        </label>
      )}
      {/* URL 직접 입력 */}
      {!locked && !url && (
        <input
          type="text"
          placeholder="또는 이미지 URL 붙여넣기"
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-3 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] tracking-[0.004em] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)] text-[12px]"
        />
      )}
    </div>
  );
}
