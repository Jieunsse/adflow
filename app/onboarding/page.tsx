"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { readProfiles, type BrandProfileEntry } from "@features/brand-profile/model/useBrandProfileStorage";
import { upsertProfile, setActiveIdInStorage } from "@features/brand-profile/model/brandProfileStore";
import { onboardedKey } from "@widgets/onboarding-guard";

type Step = 1 | 2 | 3;

function stepFromParam(raw: string | null): Step {
  const n = Number(raw);
  if (n >= 1 && n <= 3) return n as Step;
  return 1;
}

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="flex gap-1.5">
      {([1, 2, 3] as Step[]).map((s) => (
        <span
          key={s}
          className="flex-1 h-1 rounded-sm transition-[background] duration-[160ms]"
          style={{ background: step >= s ? "var(--w-primary-normal)" : "var(--w-line-neutral)" }}
        />
      ))}
    </div>
  );
}

function StepLabel({ step }: { step: Step }) {
  const labels: Record<Step, string> = {
    1: "계정 연결",
    2: "브랜드 프로필",
    3: "완료",
  };
  return (
    <span
      className="font-semibold text-[11px] leading-[1.45] tracking-[0.1em] uppercase text-[var(--w-primary-normal)] block"
      style={{ marginTop: 14 }}
    >
      STEP {step} / 3 · {labels[step]}
    </span>
  );
}

// Step 1 — 세션에 adAccountId 있으면 연결 확인, 없으면 /setup으로 이동
function Step1({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const connected = !!(session?.adAccountId && session?.pageId);
  const browseMode = !!session?.browseMode;

  return (
    <div className="flex flex-col gap-[22px]">
      <div>
        <h1 className="font-[800] text-[21px] leading-[1.3] [font-family:var(--w-font-display)] text-[var(--w-fg-strong)] tracking-[-0.02em] m-0">
          광고 계정을 연결해주세요
        </h1>
        <p className="font-medium text-[14px] leading-[1.55] text-[var(--w-fg-neutral)] mt-2 mb-0">
          Meta 광고 계정과 페이스북 페이지를 선택해야 광고를 집행할 수 있어요.
        </p>
      </div>

      {status === "loading" && (
        <div className="flex items-center gap-2 py-4 text-[var(--w-fg-neutral)] font-medium text-[13px]">
          <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-4 h-4" />
          <span>불러오는 중…</span>
        </div>
      )}

      {status === "authenticated" && connected && (
        <div className="flex items-start gap-3 px-[14px] py-3.5 rounded-xl bg-[var(--w-primary-soft)] border border-[rgba(0,102,255,0.18)]">
          <div className="w-7 h-7 rounded-lg bg-[var(--w-bg-elevated)] text-[var(--w-primary-press)] grid place-items-center flex-[0_0_auto]">
            <Icon name="check" size={15} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[13px] leading-[1.4] text-[var(--w-fg-strong)]">계정이 연결되어 있어요</div>
            <div className="font-medium text-[12px] leading-[1.45] text-[var(--w-fg-neutral)] mt-0.5 truncate">
              {session?.adAccountName ?? session?.adAccountId}
            </div>
          </div>
        </div>
      )}

      {status === "authenticated" && !connected && (
        <div className="flex flex-col gap-3">
          {browseMode && (
            <div className="flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] bg-[rgba(255,146,0,0.10)] border border-[rgba(255,146,0,0.24)] text-[var(--w-status-cautionary)]">
              <Icon name="warn" size={16} />
              <span style={{ font: "500 12.5px/1.5 var(--w-font-sans)" }}>
                둘러보기 모드예요. 실제 광고 집행을 위해 계정을 연결해주세요.
              </span>
            </div>
          )}
          <Button
            variant="primary"
            size="md"
            type="button"
            onClick={() => router.push("/setup?next=/onboarding?step=2")}
          >
            계정 연결하기 <Icon name="arrow-right" size={14} />
          </Button>
        </div>
      )}

      <hr className="h-px bg-[var(--w-line-neutral)] my-0 border-0" />
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" type="button" onClick={onSkip}>
          건너뛰기
        </Button>
        {status === "authenticated" && connected && (
          <Button variant="primary" size="sm" type="button" onClick={onNext}>
            다음
          </Button>
        )}
      </div>
    </div>
  );
}

// Step 2 — 브랜드명 + 설명 경량 폼
function Step2({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  function save() {
    setSaving(true);
    try {
      const profiles = readProfiles();
      const id = `bp-${Date.now()}`;
      const isFirst = profiles.length === 0;
      const entry: BrandProfileEntry = {
        id,
        name: name.trim() || "내 브랜드",
        brandDescription: desc.trim() || undefined,
        isDefault: isFirst,
      };
      // Synced Store 경유 — 실유저면 Supabase 동기, 게스트면 로컬만.
      upsertProfile(entry);
      if (isFirst) setActiveIdInStorage(id);
    } catch {
      /* quota 등 — 무시 */
    }
    setSaving(false);
    onNext();
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <div>
        <h1 className="font-[800] text-[21px] leading-[1.3] [font-family:var(--w-font-display)] text-[var(--w-fg-strong)] tracking-[-0.02em] m-0">
          브랜드를 소개해주세요
        </h1>
        <p className="font-medium text-[14px] leading-[1.55] text-[var(--w-fg-neutral)] mt-2 mb-0">
          Gemini가 광고 소재를 만들 때 이 정보를 참고해요.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-[13px] leading-none text-[var(--w-fg-strong)]">
            브랜드명
          </label>
          <input
            type="text"
            placeholder="예) 그린루틴"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="w-full h-10 px-3.5 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[14px] font-medium text-[var(--w-fg-strong)] placeholder:text-[var(--w-fg-alternative)] outline-none focus:border-[var(--w-primary-normal)] transition-colors duration-[120ms]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-[13px] leading-none text-[var(--w-fg-strong)]">
            브랜드 설명 <span className="font-normal text-[var(--w-fg-neutral)]">(선택)</span>
          </label>
          <textarea
            placeholder="예) 20대 여성을 위한 비건 스킨케어 브랜드예요. 대표 제품은 수분크림으로 자극 없는 성분이 강점이에요."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={4}
            maxLength={600}
            className="w-full px-3.5 py-3 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[14px] font-medium text-[var(--w-fg-strong)] placeholder:text-[var(--w-fg-alternative)] outline-none focus:border-[var(--w-primary-normal)] transition-colors duration-[120ms] resize-none"
          />
        </div>
      </div>

      <hr className="h-px bg-[var(--w-line-neutral)] my-0 border-0" />
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" type="button" onClick={onSkip}>
          건너뛰기
        </Button>
        <Button
          variant="primary"
          size="sm"
          type="button"
          disabled={saving || !name.trim()}
          onClick={save}
        >
          다음
        </Button>
      </div>
    </div>
  );
}

// Step 3 — 완료 + 광고 만들기 CTA
function Step3({ onComplete }: { onComplete: (next?: string) => void | Promise<void> }) {
  async function goCreate() {
    await onComplete("/create");
  }

  async function goLater() {
    await onComplete();
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <div>
        <div className="w-12 h-12 rounded-[14px] bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] grid place-items-center mb-4">
          <Icon name="check" size={22} />
        </div>
        <h1 className="font-[800] text-[21px] leading-[1.3] [font-family:var(--w-font-display)] text-[var(--w-fg-strong)] tracking-[-0.02em] m-0">
          준비가 됐어요!
        </h1>
        <p className="font-medium text-[14px] leading-[1.55] text-[var(--w-fg-neutral)] mt-2 mb-0">
          Gemini가 카피·헤드라인·타겟팅을 제안해드려요. 지금 바로 첫 광고를 만들어봐요.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button variant="primary" size="md" type="button" onClick={goCreate}>
          광고 만들기 <Icon name="arrow-right" size={14} />
        </Button>
        <Button variant="ghost" size="sm" type="button" onClick={goLater}>
          나중에 하기
        </Button>
      </div>
    </div>
  );
}

function OnboardingFlow() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [step, setStep] = useState<Step>(1);

  useEffect(() => {
    const stepParam = searchParams.get("step");
    if (stepParam) {
      setStep(stepFromParam(stepParam));
      return;
    }
    const saved = localStorage.getItem("adflow:onboarding-step");
    setStep(saved ? stepFromParam(saved) : 1);
  }, [searchParams]);

  function advanceTo(s: Step) {
    localStorage.setItem("adflow:onboarding-step", String(s));
    setStep(s);
    window.history.replaceState(null, "", `/onboarding?step=${s}`);
  }

  async function complete(next: string = "/dashboard") {
    // localStorage 캐시를 먼저 박아 가드 루프를 차단. 서버 POST 는 best-effort.
    try {
      localStorage.setItem(onboardedKey(session?.user?.email), "true");
      localStorage.removeItem("adflow:onboarding-step");
    } catch {
      /* storage 사용 불가 — 무시 */
    }
    try {
      await fetch("/api/onboarding/status", { method: "POST" });
    } catch {
      /* 서버 저장 실패해도 진행 — 다음 가드에서 재시도 */
    }
    window.location.replace(next);
  }

  return (
    <div
      className="adflow [font-family:var(--w-font-sans)] [color:var(--w-fg-normal)] [background:var(--w-bg-alternative)] text-[14px] min-h-screen [color-scheme:light] [-webkit-font-smoothing:antialiased] [text-rendering:optimizeLegibility]"
      style={{ colorScheme: "light" }}
    >
      <div className="min-h-screen grid place-items-center px-6 py-12 relative z-[1] [background:radial-gradient(ellipse_720px_380px_at_50%_-8%,rgba(0,102,255,0.07),transparent_70%),radial-gradient(ellipse_520px_320px_at_88%_112%,rgba(101,65,242,0.06),transparent_70%),var(--w-bg-normal)]">
        <div className="w-full max-w-[460px] bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-[20px] shadow-[var(--w-shadow-card)] px-8 pt-8 pb-[26px] flex flex-col gap-[22px]">
          <div className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-[10px] [background:linear-gradient(135deg,var(--w-primary-normal),var(--w-accent-violet))] text-white grid place-items-center font-[800] text-[16px] leading-none [font-family:var(--w-font-display)] tracking-[-0.03em]">
              A
            </div>
            <span className="font-[800] text-[17px] leading-none [font-family:var(--w-font-display)] text-[var(--w-fg-strong)] tracking-[-0.022em]">
              AdFlow
            </span>
          </div>

          <div>
            <ProgressBar step={step} />
            <StepLabel step={step} />
          </div>

          {step === 1 && (
            <Step1
              onNext={() => advanceTo(2)}
              onSkip={() => advanceTo(2)}
            />
          )}
          {step === 2 && (
            <Step2
              onNext={() => advanceTo(3)}
              onSkip={() => advanceTo(3)}
            />
          )}
          {step === 3 && <Step3 onComplete={complete} />}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingFlow />
    </Suspense>
  );
}
