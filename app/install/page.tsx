"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";

type Phase = "A" | "B" | "done";

interface FaqItem {
  q: string;
  a: string;
}

interface ApiState {
  configured: boolean;
  clientId: string | null;
}

const PROGRESS_KEY = "adflow:install-progress";

const PERMISSIONS: { name: string; reason: string }[] = [
  { name: "ads_management", reason: "사용자가 페이스북·인스타그램 광고를 직접 만들고 게재할 수 있도록 캠페인 생성·수정·일시정지에 필요해요." },
  { name: "ads_read", reason: "광고 성과(노출수·클릭수·비용)를 사용자에게 대시보드로 보여주기 위해 필요해요." },
  { name: "pages_show_list", reason: "사용자가 자신이 관리하는 페이스북 페이지 중 광고에 사용할 페이지를 선택할 수 있어요." },
  { name: "pages_read_engagement", reason: "선택한 페이지의 기본 정보(이름·이미지)를 가져와서 미리보기로 보여줘요." },
  { name: "business_management", reason: "사용자가 속한 비즈니스 계정의 광고 계정 목록을 불러와요." },
  { name: "instagram_basic", reason: "페이지에 연결된 인스타그램 비즈니스 계정 정보를 확인해서 인스타그램 광고를 게재해요." },
  { name: "instagram_manage_insights", reason: "인스타그램 광고의 성과(노출수·도달·반응)를 사용자에게 보여줘요." },
];

const FAQ_BY_STEP: Record<number, FaqItem[]> = {
  1: [
    { q: "개인 페이스북 계정으로 가입해도 되나요?", a: "회사 계정을 사용하는걸 추천해요. 마케팅용 계정으로 연동해도 좋아요." },
    { q: "전화번호 인증이 필요해요", a: "Meta는 보안을 위해 전화번호 인증을 요구해요. 회사 대표번호로 진행해도 무방해요." },
  ],
  2: [
    { q: "앱 종류는 뭘 골라야 하나요?", a: "'비즈니스(Business)'를 선택해주세요. 광고 관리 권한을 받기 위해 필요해요." },
    { q: "비즈니스 계정이 없다고 떠요", a: "먼저 business.facebook.com 에서 비즈니스 계정을 만든 뒤 다시 시도해주세요." },
    { q: "앱 이름은 뭐라고 지어야 하나요?", a: "회사명 또는 'AdFlow - 회사명' 형식으로 자유롭게 지으면 돼요.\nMeta App Review 시 이름이 보이니 회사 정체성에 맞게 정해주세요." },
  ],
  3: [
    { q: "App Secret이 어디 있나요?", a: "Meta 앱 콘솔 → 설정 → 기본 → App Secret 항목의 '표시' 버튼을 누르면 보여요." },
    { q: "입력했는데 '자격증명이 올바르지 않다'고 떠요", a: "App ID와 Secret이 다른 앱의 것이 섞이지 않았는지, 공백이 없는지 확인해주세요. 비즈니스 앱이 아닌 다른 종류로 만들었으면 새로 만들어야 해요." },
  ],
  4: [
    { q: "권한이 이미 추가되어 있는데 다시 추가해도 되나요?", a: "이미 있는 권한은 Meta가 자동으로 인식하니 중복 추가 걱정 없어요." },
    { q: "Standard Access와 Advanced Access의 차이가 뭔가요?", a: "Standard는 자기 자신의 데이터만, Advanced는 다른 사용자 데이터까지 접근할 수 있어요. AdFlow는 회사 직원 모두가 쓸 수 있도록 Advanced Access가 필요해요." },
  ],
  5: [
    { q: "App Review에 보통 얼마나 걸리나요?", a: "Meta 영업일 기준 1주 ~ 3주 정도 걸려요. 사유서가 명확할수록 빠르게 통과돼요." },
    { q: "거절되면 어떻게 하나요?", a: "거절 사유를 확인한 뒤 사유서를 보완해서 무제한 재신청 가능해요. 권한별 사유를 더 구체적으로 적으면 통과 확률이 올라가요." },
    { q: "App Review 통과 전까지는 AdFlow를 못 쓰나요?", a: "아니에요. 개발 모드에서 팀장(앱 소유자) + 등록한 테스트 계정은 즉시 사용 가능해요. App Review는 전 직원 사용을 위한 단계예요." },
  ],
  6: [
    { q: "라이브 모드로 바꾸면 즉시 전 직원이 쓸 수 있나요?", a: "네, 라이브 전환 즉시 모든 사용자가 페이스북 로그인으로 AdFlow를 쓸 수 있어요." },
    { q: "라이브 전환 후 문제가 생기면 다시 개발 모드로 돌릴 수 있나요?", a: "가능해요. Meta 앱 콘솔에서 언제든 토글할 수 있어요. 단, 라이브에서 개발로 돌리면 외부 사용자 접근이 차단돼요." },
  ],
};

function Faq({ step }: { step: number }) {
  const items = FAQ_BY_STEP[step] ?? [];
  if (items.length === 0) return null;
  return (
    <details className="border border-[var(--w-line-alternative)] rounded-[10px] bg-[var(--w-bg-alternative)]">
      <summary className="list-none cursor-pointer flex items-center gap-2 px-[14px] py-3 font-semibold text-[12.5px] leading-none text-[var(--w-fg-neutral)] [&::-webkit-details-marker]:hidden">
        <Icon name="info" size={14} /> 자주 막히는 부분
        <Icon name="chev-down" size={14} className="ml-auto transition-transform duration-[180ms] [[open]_&]:rotate-180" />
      </summary>
      <div className="border-t border-[var(--w-line-alternative)] px-[14px] py-3 flex flex-col gap-3.5">
        {items.map((item) => (
          <div key={item.q} className="flex flex-col gap-1">
            <div className="font-semibold text-[12.5px] leading-[1.45] text-[var(--w-fg-strong)]">{item.q}</div>
            <div className="font-medium text-[12.5px] leading-[1.6] text-[var(--w-fg-neutral)] whitespace-pre-line">{item.a}</div>
          </div>
        ))}
      </div>
    </details>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 self-start px-[14px] py-2 rounded-lg bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] font-semibold text-[12.5px] leading-none no-underline transition-[background] duration-[140ms] hover:bg-[rgba(0,102,255,0.16)]"
    >
      {children}
      <Icon name="arrow-right" size={12} />
    </a>
  );
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="m-0 px-4 py-[14px] pr-20 border border-[var(--w-line-normal)] rounded-[10px] bg-[var(--w-bg-alternative)] text-[var(--w-fg-strong)] [font-family:var(--w-font-mono,ui-monospace,monospace)] font-medium text-[12.5px] leading-[1.65] whitespace-pre-wrap break-words max-h-[280px] overflow-auto">{text}</pre>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        className="absolute top-2 right-2"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "복사됨!" : "복사"}
      </Button>
    </div>
  );
}

function SetupSteps({ total, filled }: { total: number; filled: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`flex-1 h-1 rounded-sm transition-[background] duration-[160ms] ${i < filled ? "bg-[var(--w-primary-normal)]" : "bg-[var(--w-line-neutral)]"}`}
        />
      ))}
    </div>
  );
}

function PhaseHeader({
  step,
  totalInPhase,
  title,
  subtitle,
}: {
  phase: Phase;
  step: number;
  totalInPhase: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <SetupSteps total={totalInPhase} filled={step} />
      <span
        className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-primary-normal)] block"
        style={{ marginTop: 14, letterSpacing: "0.1em" }}
      >
        STEP {step}
      </span>
      <h1 className="font-[800] text-[21px] leading-[1.3] [font-family:var(--w-font-display)] text-[var(--w-fg-strong)] tracking-[-0.02em] m-0" style={{ marginTop: 8 }}>{title}</h1>
      <p className="font-medium text-[13.5px] leading-[1.55] text-[var(--w-fg-neutral)] mt-2 mb-0">{subtitle}</p>
    </div>
  );
}

function Step1Signup({ onNext }: { onNext: () => void }) {
  return (
    <>
      <PhaseHeader
        phase="A"
        step={1}
        totalInPhase={3}
        title="Meta 개발자 계정으로 가입해주세요"
        subtitle="이미 가입돼 있다면 다음 단계로 넘어가요."
      />
      <div className="flex flex-col gap-4 font-medium text-[13.5px] leading-[1.6] text-[var(--w-fg-strong)]">
        <p className="m-0 text-[var(--w-fg-neutral)]">
          페이스북 / 인스타그램 광고 API를 쓰려면 Meta 개발자 계정이 필요해요.
          <br />
          사내 마케팅 계정으로 등록 가능해요.
        </p>
        <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 self-start px-[14px] py-2 rounded-lg bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] font-semibold text-[12.5px] leading-none no-underline transition-[background] duration-[140ms] hover:bg-[rgba(0,102,255,0.16)]">
          META 개발자센터 링크
        </a>
        <Faq step={1} />
      </div>
      <div className="flex flex-wrap gap-2" style={{ justifyContent: "flex-end" }}>
        <Button variant="primary" size="sm" type="button" onClick={onNext}>
          다음으로
        </Button>
      </div>
    </>
  );
}

function Step2CreateApp({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <>
      <PhaseHeader
        phase="A"
        step={2}
        totalInPhase={3}
        title="비즈니스 앱을 만들어주세요"
        subtitle="AdFlow가 광고를 게재할 Meta 앱이에요."
      />
      <div className="flex flex-col gap-4 font-medium text-[13.5px] leading-[1.6] text-[var(--w-fg-strong)]">
        <ol className="m-0 pl-[22px] flex flex-col gap-1.5 font-medium text-[13px] leading-[1.55] text-[var(--w-fg-neutral)]" style={{ listStyle: "none", paddingLeft: 0 }}>
          <li>1. '앱 만들기' 페이지를 열어요.</li>
          <li>2. 앱 종류는 <b>'비즈니스(Business)'</b>를 선택해주세요.</li>
          <li>3. 앱 이름은 회사명 또는 'AdFlow - 회사명' 형식으로 자유롭게 지어요.</li>
          <li>4. 비즈니스 계정 선택 화면이 나오면 회사 계정을 골라주세요.</li>
        </ol>
        <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 self-start px-[14px] py-2 rounded-lg bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] font-semibold text-[12.5px] leading-none no-underline transition-[background] duration-[140ms] hover:bg-[rgba(0,102,255,0.16)]">
          앱 만들기 페이지 열기
        </a>
        <Faq step={2} />
      </div>
      <div className="flex flex-wrap gap-2" style={{ justifyContent: "space-between" }}>
        <Button variant="ghost" size="sm" type="button" onClick={onBack}>
          이전
        </Button>
        <Button variant="primary" size="sm" type="button" onClick={onNext}>
          다음으로
        </Button>
      </div>
    </>
  );
}

function Step3Credentials({ onSaved, onBack, preview = false }: { onSaved: (appName: string) => void; onBack: () => void; preview?: boolean }) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (preview) {
      onSaved("샘플 Meta 앱");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/install/meta-app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "저장에 실패했어요.");
        return;
      }
      onSaved(data.app?.name ?? "Meta 앱");
    } catch {
      setError("네트워크 오류가 발생했어요. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = !clientId.trim() || !clientSecret.trim() || busy;

  return (
    <>
      <PhaseHeader
        phase="A"
        step={3}
        totalInPhase={3}
        title="App ID와 App Secret을 입력해주세요"
        subtitle="Meta 앱 콘솔 → 설정 → 기본 화면에서 복사하면 돼요."
      />
      <div className="flex flex-col gap-4 font-medium text-[13.5px] leading-[1.6] text-[var(--w-fg-strong)]">
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)] tracking-[0.02em]">App ID</span>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="예: 1234567890123456"
            className="border border-[var(--w-line-normal)] rounded-lg px-[13px] py-[11px] font-medium text-[13.5px] leading-[1.4] [font-family:var(--w-font-mono,var(--w-font-sans))] bg-[var(--w-bg-base)] text-[var(--w-fg-strong)] transition-[border-color] duration-[140ms] outline-none focus:border-[var(--w-primary-normal)] disabled:bg-[var(--w-bg-alternative)] disabled:text-[var(--w-fg-neutral)]"
            disabled={busy}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold text-[12px] leading-none text-[var(--w-fg-neutral)] tracking-[0.02em]">App Secret</span>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="••••••••••••••••"
            className="border border-[var(--w-line-normal)] rounded-lg px-[13px] py-[11px] font-medium text-[13.5px] leading-[1.4] [font-family:var(--w-font-mono,var(--w-font-sans))] bg-[var(--w-bg-base)] text-[var(--w-fg-strong)] transition-[border-color] duration-[140ms] outline-none focus:border-[var(--w-primary-normal)] disabled:bg-[var(--w-bg-alternative)] disabled:text-[var(--w-fg-neutral)]"
            disabled={busy}
          />
        </label>
        {error && (
          <div className="flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] border border-transparent bg-[rgba(255,146,0,0.10)] border-[rgba(255,146,0,0.24)] text-[var(--w-status-cautionary)]">
            <Icon name="warn" size={16} />
            <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)" }}>{error}</div>
          </div>
        )}
        <Faq step={3} />
      </div>
      <div className="flex flex-wrap gap-2" style={{ justifyContent: "space-between" }}>
        <Button variant="ghost" size="sm" type="button" onClick={onBack} disabled={busy}>
          이전
        </Button>
        <Button variant="primary" size="sm" type="button" disabled={disabled} onClick={submit}>
          {busy ? (
            <>
              <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[14px] h-[14px]" /> 검증 중…
            </>
          ) : (
            "자격증명 저장하기"
          )}
        </Button>
      </div>
    </>
  );
}

function Step4Permissions({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const permList = PERMISSIONS.map((p) => p.name).join("\n");
  return (
    <>
      <PhaseHeader
        phase="B"
        step={1}
        totalInPhase={3}
        title="필요한 권한 7개를 추가해주세요"
        subtitle="Meta 앱 콘솔 → '앱 검수' → '권한 및 기능'에서 추가해요."
      />
      <div className="flex flex-col gap-4 font-medium text-[13.5px] leading-[1.6] text-[var(--w-fg-strong)]">
        <ol className="m-0 pl-[22px] flex flex-col gap-1.5 font-medium text-[13px] leading-[1.55] text-[var(--w-fg-neutral)]">
          <li>아래 권한 목록을 복사해서 하나씩 검색해 추가해주세요.</li>
          <li>각 권한 옆 'Advanced Access 요청' 버튼을 눌러주세요.</li>
        </ol>
        <CopyBlock text={permList} />
        <ExternalLink href="https://developers.facebook.com/apps/">내 Meta 앱 콘솔 열기</ExternalLink>
        <Faq step={4} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" type="button" onClick={onBack}>
          <Icon name="arrow-left" size={13} /> 이전
        </Button>
        <Button variant="primary" size="sm" type="button" onClick={onNext}>
          권한을 추가했어요 <Icon name="arrow-right" size={13} />
        </Button>
      </div>
    </>
  );
}

function Step5Review({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const reasonsText = PERMISSIONS.map((p) => `[${p.name}]\n${p.reason}`).join("\n\n");
  return (
    <>
      <PhaseHeader
        phase="B"
        step={2}
        totalInPhase={3}
        title="App Review를 신청해주세요"
        subtitle="아래 사유서 템플릿을 권한별 사유 입력란에 그대로 붙여넣으면 돼요."
      />
      <div className="flex flex-col gap-4 font-medium text-[13.5px] leading-[1.6] text-[var(--w-fg-strong)]">
        <ol className="m-0 pl-[22px] flex flex-col gap-1.5 font-medium text-[13px] leading-[1.55] text-[var(--w-fg-neutral)]">
          <li>Meta 앱 콘솔에서 권한별 'Submit for review' 버튼을 눌러요.</li>
          <li>사유 입력란에 아래 해당 권한의 사유를 복사해서 붙여넣어요.</li>
          <li>데모 영상은 AdFlow 화면 녹화로 충분해요 (캠페인 생성 → 결과 조회 흐름).</li>
          <li>신청 후 Meta 검토를 기다리면 돼요. 보통 1~3주 소요.</li>
        </ol>
        <CopyBlock text={reasonsText} />
        <Faq step={5} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" type="button" onClick={onBack}>
          <Icon name="arrow-left" size={13} /> 이전
        </Button>
        <Button variant="primary" size="sm" type="button" onClick={onNext}>
          App Review 신청했어요 <Icon name="arrow-right" size={13} />
        </Button>
      </div>
    </>
  );
}

function Step6GoLive({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  return (
    <>
      <PhaseHeader
        phase="B"
        step={3}
        totalInPhase={3}
        title="라이브 모드로 전환해주세요"
        subtitle="App Review 통과 메일을 받으셨다면 마지막 단계예요."
      />
      <div className="flex flex-col gap-4 font-medium text-[13.5px] leading-[1.6] text-[var(--w-fg-strong)]">
        <ol className="m-0 pl-[22px] flex flex-col gap-1.5 font-medium text-[13px] leading-[1.55] text-[var(--w-fg-neutral)]">
          <li>Meta 앱 콘솔 → 설정 → 기본 화면을 열어요.</li>
          <li>상단의 '앱 모드' 토글을 <b>'라이브'</b>로 전환해주세요.</li>
          <li>아래 버튼을 눌러 셋업을 완료해주세요.</li>
        </ol>
        <ExternalLink href="https://developers.facebook.com/apps/">내 Meta 앱 콘솔 열기</ExternalLink>
        <Faq step={6} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" type="button" onClick={onBack}>
          <Icon name="arrow-left" size={13} /> 이전
        </Button>
        <Button variant="primary" size="sm" type="button" onClick={onDone}>
          셋업 완료 <Icon name="arrow-right" size={13} />
        </Button>
      </div>
    </>
  );
}

function PhaseADone({ appName, onStartPhaseB, onLogin }: { appName: string; onStartPhaseB: () => void; onLogin: () => void }) {
  return (
    <>
      <div>
        <SetupSteps total={3} filled={3} />
        <span
          className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-primary-normal)] block"
          style={{ marginTop: 14, letterSpacing: "0.1em" }}
        >
          Phase A 완료
        </span>
        <h1 className="font-[800] text-[21px] leading-[1.3] [font-family:var(--w-font-display)] text-[var(--w-fg-strong)] tracking-[-0.02em] m-0" style={{ marginTop: 8 }}>
          <b>{appName}</b> 와 연결됐어요
        </h1>
        <p className="font-medium text-[13.5px] leading-[1.55] text-[var(--w-fg-neutral)] mt-2 mb-0">
          이제 AdFlow를 개발 모드로 사용할 수 있어요. 팀장과 등록된 테스트 계정만 가능해요.
          전 직원 사용을 위해선 Phase B(App Review)를 진행해주세요.
        </p>
      </div>
      <div className="flex flex-col gap-4 font-medium text-[13.5px] leading-[1.6] text-[var(--w-fg-strong)]">
        <div className="flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] border border-transparent bg-[rgba(0,102,255,0.06)] border-[rgba(0,102,255,0.18)] text-[var(--w-primary-press)]">
          <Icon name="info" size={16} />
          <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)" }}>
            Phase B는 시간이 있을 때 진행해도 돼요. App Review 신청 후 통과까지 1~3주 정도 걸려요.
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" type="button" onClick={onStartPhaseB}>
          Phase B 시작하기
        </Button>
        <Button variant="primary" size="sm" type="button" onClick={onLogin}>
          AdFlow 사용 시작 <Icon name="arrow-right" size={13} />
        </Button>
      </div>
    </>
  );
}

function AllDone({ onGo }: { onGo: () => void }) {
  return (
    <>
      <div>
        <SetupSteps total={3} filled={3} />
        <span
          className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-primary-normal)] block"
          style={{ marginTop: 14, letterSpacing: "0.1em" }}
        >
          모든 셋업 완료
        </span>
        <h1 className="font-[800] text-[21px] leading-[1.3] [font-family:var(--w-font-display)] text-[var(--w-fg-strong)] tracking-[-0.02em] m-0" style={{ marginTop: 8 }}>
          AdFlow를 전 직원과 함께 사용할 수 있어요
        </h1>
        <p className="font-medium text-[13.5px] leading-[1.55] text-[var(--w-fg-neutral)] mt-2 mb-0">
          페이스북 로그인을 통해 회사 모든 직원이 AdFlow를 쓸 수 있어요.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span />
        <Button variant="primary" size="sm" type="button" onClick={onGo}>
          대시보드로 이동 <Icon name="arrow-right" size={13} />
        </Button>
      </div>
    </>
  );
}

function InstallPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preview = searchParams?.get("preview") === "1";
  const [phase, setPhase] = useState<Phase>("A");
  const [step, setStep] = useState<number>(1);
  const [appName, setAppName] = useState<string>("Meta 앱");
  const [bootLoading, setBootLoading] = useState(true);

  useEffect(() => {
    if (preview) {
      setPhase("A");
      setStep(1);
      setBootLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/install/meta-app");
        const data = (await res.json()) as ApiState;
        if (data.configured) {
          const saved = typeof window !== "undefined" ? window.localStorage.getItem(PROGRESS_KEY) : null;
          if (saved) {
            const parsed = JSON.parse(saved) as { phase: Phase; step: number };
            setPhase(parsed.phase);
            setStep(parsed.step);
          } else {
            setPhase("B");
            setStep(1);
          }
        }
      } catch {
        // 첫 진입 — 그대로 Phase A 시작
      } finally {
        setBootLoading(false);
      }
    })();
  }, [preview]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (preview) return;
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ phase, step }));
  }, [phase, step, preview]);

  function handleSaved(name: string) {
    setAppName(name);
    setStep(4);
  }

  function startPhaseB() {
    setPhase("B");
    setStep(1);
  }

  function goLogin() {
    if (preview) {
      router.push("/settings");
      return;
    }
    router.push("/login");
  }

  function finishAll() {
    setPhase("done");
    if (typeof window !== "undefined" && !preview) {
      window.localStorage.removeItem(PROGRESS_KEY);
    }
  }

  return (
    <div
      className="[font-family:var(--w-font-sans)] [color:var(--w-fg-normal)] [background:var(--w-bg-alternative)] text-[14px] min-h-screen [color-scheme:light] [-webkit-font-smoothing:antialiased] [text-rendering:optimizeLegibility]"
      style={{ colorScheme: "light" }}
    >
      <div
        className="min-h-screen grid place-items-center px-6 py-12 relative z-[1] [background:radial-gradient(ellipse_720px_380px_at_50%_-8%,rgba(0,102,255,0.07),transparent_70%),radial-gradient(ellipse_520px_320px_at_88%_112%,rgba(101,65,242,0.06),transparent_70%),var(--w-bg-normal)]"
        data-screen-label="AdFlow 설치"
      >
        <div className="w-full max-w-[640px] bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-[20px] shadow-[var(--w-shadow-card)] px-8 pt-8 pb-[26px] flex flex-col gap-[22px]">
          <div className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-[10px] [background:linear-gradient(135deg,var(--w-primary-normal),var(--w-accent-violet))] text-white grid place-items-center font-[800] text-[16px] leading-none [font-family:var(--w-font-display)] tracking-[-0.03em]">A</div>
            <span className="font-[800] text-[17px] leading-none [font-family:var(--w-font-display)] text-[var(--w-fg-strong)] tracking-[-0.022em]">AdFlow</span>
          </div>

          {preview && (
            <div className="flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] border border-transparent bg-[rgba(0,102,255,0.06)] border-[rgba(0,102,255,0.18)] text-[var(--w-primary-press)]">
              <Icon name="info" size={16} />
              <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)" }}>
                <b>미리보기 모드</b> · 개발자센터 연동을 미리 확인하는 용도예요. 입력값과 진행 상태는 저장되지 않아요.
              </div>
            </div>
          )}

          {bootLoading ? (
            <div className="flex flex-col items-center gap-3 py-[34px] text-[var(--w-fg-neutral)] font-medium text-[13px] leading-[1.4]">
              <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[18px] h-[18px]" />
              <span>현재 상태 확인 중…</span>
            </div>
          ) : phase === "done" ? (
            <AllDone onGo={goLogin} />
          ) : phase === "A" ? (
            <>
              {step === 1 && <Step1Signup onNext={() => setStep(2)} />}
              {step === 2 && <Step2CreateApp onNext={() => setStep(3)} onBack={() => setStep(1)} />}
              {step === 3 && <Step3Credentials onSaved={handleSaved} onBack={() => setStep(2)} preview={preview} />}
              {step === 4 && <PhaseADone appName={appName} onStartPhaseB={startPhaseB} onLogin={goLogin} />}
            </>
          ) : (
            <>
              {step === 1 && <Step4Permissions onNext={() => setStep(2)} onBack={() => setStep(1)} />}
              {step === 2 && <Step5Review onNext={() => setStep(3)} onBack={() => setStep(1)} />}
              {step === 3 && <Step6GoLive onDone={finishAll} onBack={() => setStep(2)} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InstallPage() {
  return (
    <Suspense
      fallback={
        <div
          className="[font-family:var(--w-font-sans)] [color:var(--w-fg-normal)] [background:var(--w-bg-alternative)] text-[14px] min-h-screen [color-scheme:light] [-webkit-font-smoothing:antialiased] [text-rendering:optimizeLegibility]"
          style={{ colorScheme: "light" }}
        >
          <div
            className="min-h-screen grid place-items-center px-6 py-12 relative z-[1] [background:radial-gradient(ellipse_720px_380px_at_50%_-8%,rgba(0,102,255,0.07),transparent_70%),radial-gradient(ellipse_520px_320px_at_88%_112%,rgba(101,65,242,0.06),transparent_70%),var(--w-bg-normal)]"
            data-screen-label="AdFlow 설치"
          >
            <div className="w-full max-w-[640px] bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-[20px] shadow-[var(--w-shadow-card)] px-8 pt-8 pb-[26px] flex flex-col gap-[22px]">
              <div className="flex flex-col items-center gap-3 py-[34px] text-[var(--w-fg-neutral)] font-medium text-[13px] leading-[1.4]">
                <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[18px] h-[18px]" />
                <span>로딩 중…</span>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <InstallPageInner />
    </Suspense>
  );
}
