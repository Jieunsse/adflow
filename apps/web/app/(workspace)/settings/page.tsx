"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import IdField from "@shared/ui/IdField";
import { Chip } from "@shared/ui/Chip";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { cn } from "@shared/lib/cn";
import { useToast } from "@shared/ui/Toast";
import { useNotifSettings } from "@shared/lib/notifications";
import { notifyScopedStorageChange } from "@shared/lib/storage/useScopedStorage";
import { onboardedKey } from "@widgets/onboarding-guard";

export default function SettingsPage() {
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;
  const isLeader = session?.role === "팀장" || browseMode;

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label="설정">
      <div className="flex justify-between items-end gap-6">
        <div>
          <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">설정</span>
          <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]" style={{ marginTop: 4 }}>설정</h1>
          <p className="font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-neutral)] mt-1.5 mb-0">내 환경과 워크스페이스 운영 설정을 관리해요.</p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div><span className="w-overline text-[var(--w-fg-neutral)]">내 환경</span><h2 className="w-h3 m-0 mt-1 text-[var(--w-fg-strong)]">이 기기 설정</h2></div>
        <div className="flex flex-col gap-5"><NotifTab /><DangerTab /></div>
      </section>

      <section id="measurement" className="flex flex-col gap-3">
        <div><span className="w-overline text-[var(--w-fg-neutral)]">워크스페이스</span><h2 className="w-h3 m-0 mt-1 text-[var(--w-fg-strong)]">전환 측정</h2></div>
        <MeasureTab />
      </section>

      {isLeader && (
        <section className="flex flex-col gap-3">
          <div><span className="w-overline text-[var(--w-fg-neutral)]">관리자</span><h2 className="w-h3 m-0 mt-1 text-[var(--w-fg-strong)]">서비스 자격증명</h2></div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <MetaAppCard previewMode={browseMode} />
            <GeminiApiKeyCard previewMode={browseMode} />
          </div>
        </section>
      )}
    </div>
  );
}

// ── 전환 측정 ────────────────────────────────────────────────────────────────
function pixelBaseSnippet(id: string) {
  return `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${id}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel Code -->`;
}

const PURCHASE_SNIPPET = `<script>
  fbq('track', 'Purchase', {
    value: 39000,        // 주문 금액 — 실제 결제 금액으로 바꿔주세요
    currency: 'KRW',
  });
</script>`;

const MEASURE_STEPS: [string, string][] = [
  ["Meta 이벤트 관리자에서 픽셀을 만들어요", "business.facebook.com/events_manager 에서 데이터 소스 → 웹 → 픽셀을 만들고 ID를 복사해요."],
  ["기본 코드를 모든 페이지에 붙여요", "쇼핑몰 관리자의 '헤더 스크립트' 또는 </head> 바로 위에 넣으면 돼요."],
  ["구매 이벤트를 주문 완료 페이지에 붙여요", "결제가 끝난 뒤 뜨는 페이지에만 넣어요. 금액을 실제 결제 금액으로 바꿔야 ROAS가 맞아요."],
];

function MeasureTab() {
  const showToast = useToast();
  const router = useRouter();
  const [pixelId, setPixelId] = useState("");
  const [pixelName, setPixelName] = useState("");
  useEffect(() => {
    fetch("/api/workspace/meta-target")
      .then((res) => res.json())
      .then((data: { target?: { pixelId?: string; pixelName?: string } }) => {
        setPixelId(data.target?.pixelId ?? "");
        setPixelName(data.target?.pixelName ?? "");
      });
  }, []);
  const activeId = pixelId || "<픽셀 ID>";

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label}를 복사했어요.`);
  };

  return (
    <div className="flex flex-col gap-5 max-w-[820px]">
      <Card variant="lg" className="flex flex-col gap-0">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--w-primary-soft)", color: "var(--w-primary-press)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <Icon name="target" size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">전환 측정</h2>
              {pixelId ? <Chip variant="success" size="sm" dot>연결됨</Chip> : <Chip variant="warn" size="sm">미설정</Chip>}
            </div>
            <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">
              구매가 어디서 일어났는지 알아야 ROAS와 손익을 계산할 수 있어요. 연결에서 고른 워크스페이스 Pixel로 코드를 만들어요.
            </p>
          </div>
        </div>
        <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
        {pixelId ? (
          <IdField label="워크스페이스 Pixel" id={pixelId} desc={pixelName || "연결 화면에서 선택한 전환 측정 Pixel이에요."} />
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="m-0 font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]">Pixel을 선택하면 아래 코드에 자동으로 채워져요.</p>
            <Button variant="secondary" size="sm" type="button" onClick={() => router.push("/connect")}>연결에서 Pixel 선택</Button>
          </div>
        )}
      </Card>

      <Card variant="lg" className="flex flex-col gap-0">
        <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">붙이는 순서</h2>
        <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
        <ol className="m-0 p-0 list-none flex flex-col gap-3.5">
          {MEASURE_STEPS.map(([title, desc], i) => (
            <li key={title} className="flex gap-3.5">
              <span className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-[var(--w-bg-alternative)] font-bold text-[13px] text-[var(--w-fg-normal)]">{i + 1}</span>
              <div>
                <div className="font-semibold text-[14px] leading-[1.4] text-[var(--w-fg-strong)]">{title}</div>
                <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-0.5">{desc}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <SnippetCard
        title="기본 코드 — 모든 페이지"
        desc="방문·조회를 잡아요. 이게 없으면 구매 이벤트도 안 잡혀요."
        code={pixelBaseSnippet(activeId)}
        onCopy={() => copy(pixelBaseSnippet(activeId), "기본 코드")}
        warn={!pixelId ? "연결에서 Pixel을 선택하면 코드에 자동으로 채워져요." : undefined}
      />
      <SnippetCard
        title="구매 이벤트 — 주문 완료 페이지"
        desc="금액과 통화를 같이 보내야 전환매출·ROAS가 계산돼요."
        code={PURCHASE_SNIPPET}
        onCopy={() => copy(PURCHASE_SNIPPET, "구매 이벤트 코드")}
      />

      <div className="flex items-start gap-2.5 p-3 px-[14px] rounded-[10px] border bg-[rgba(0,102,255,0.06)] border-[rgba(0,102,255,0.18)] text-[var(--w-primary-press)] font-medium text-[13px] leading-[1.5]">
        <Icon name="info" size={14} style={{ flex: "0 0 auto", marginTop: 2 }} />
        <span>붙인 뒤 Meta 이벤트 관리자에서 &apos;테스트 이벤트&apos;로 실제로 들어오는지 확인해 주세요. 데이터는 보통 20분 안에 대시보드에 반영돼요.</span>
      </div>
    </div>
  );
}

function SnippetCard({ title, desc, code, onCopy, warn }:{ title: string; desc: string; code: string; onCopy: () => void; warn?: string }) {
  return (
    <Card variant="lg" className="flex flex-col gap-0">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">{title}</h2>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">{desc}</p>
        </div>
        <Button variant="secondary" size="sm" type="button" onClick={onCopy}><Icon name="copy" size={14} /> 복사</Button>
      </div>
      {warn && (
        <div className="font-medium text-[12px] leading-[1.5] text-[var(--w-status-cautionary)] mt-2.5">{warn}</div>
      )}
      <pre className="mt-3.5 mb-0 p-4 rounded-xl bg-[var(--w-bg-alternative)] overflow-x-auto font-normal text-[12px] leading-[1.7] [font-family:var(--w-font-mono)] text-[var(--w-fg-normal)]">
        <code>{code}</code>
      </pre>
    </Card>
  );
}

interface MetaAppState {
  configured: boolean;
  clientId: string | null;
  audit: { actor: string; action: "set" | "clear"; timestamp: string }[];
}

function MetaAppCard({ previewMode = false }: { previewMode?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<MetaAppState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/install/meta-app")
      .then((r) => r.json())
      .then((data) => setState(data))
      .catch(() => setState({ configured: false, clientId: null, audit: [] }))
      .finally(() => setLoading(false));
  }, []);

  const lastChange = state?.audit.filter((a) => a.action === "set").slice(-1)[0];
  const installHref = previewMode ? "/install?preview=1" : "/install";

  return (
    <Card variant="lg" className="flex flex-col gap-0">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--w-accent-violet-soft)", color: "var(--w-accent-violet)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
          <Icon name="settings" size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">Meta 앱 연결</h2>
            <Chip variant={previewMode ? "warn" : "violet"} size="sm">{previewMode ? "둘러보기" : "관리자"}</Chip>
          </div>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">
            {previewMode
              ? "Meta 개발자센터 가입부터 라이브 전환까지의 연결 과정을 미리 둘러볼 수 있어요. 저장은 되지 않아요."
              : "AdFlow가 Meta 광고 API를 호출할 때 사용하는 앱 자격증명이에요. 교체하면 모든 사용자가 다시 로그인해야 해요."}
          </p>
        </div>
      </div>
      <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
      {loading ? (
        <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)]">불러오는 중…</div>
      ) : state?.configured ? (
        <>
          <IdField
            label="App ID"
            id={state.clientId}
            desc="AdFlow가 Meta 광고 API를 호출할 때 사용하는 앱 고유 식별자."
          />
          <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)]">
              {lastChange
                ? `마지막 변경: ${new Date(lastChange.timestamp).toLocaleString("ko-KR")} · ${lastChange.actor}`
                : "변경 이력이 없어요."}
            </div>
            <Button variant="secondary" size="sm" type="button" onClick={() => router.push(installHref)}>
              {previewMode ? "연결하기" : "자격증명 교체"} <Icon name="arrow-right" size={13} />
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3 py-4 px-[18px] rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-elevated)]" style={{ borderStyle: "dashed" }}>
          <div>
            <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">Meta 앱이 연결되지 않았어요</div>
            <div className="font-medium text-[13px] leading-[1.4] text-[var(--w-fg-neutral)] mt-0.5">로그인이 동작하려면 Meta 앱 자격증명을 먼저 등록해야 해요.</div>
          </div>
          <Button variant="primary" size="sm" type="button" onClick={() => router.push("/install")}>
            <Icon name="link" size={14} /> 셋업 시작
          </Button>
        </div>
      )}
    </Card>
  );
}

interface GeminiKeyState {
  configured: boolean;
  source: "saved" | "env" | null;
}

function GeminiApiKeyCard({ previewMode = false }: { previewMode?: boolean }) {
  const showToast = useToast();
  const [state, setState] = useState<GeminiKeyState | null>(previewMode ? { configured: true, source: "saved" } : null);
  const [apiKey, setApiKey] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (previewMode) return;
    fetch("/api/settings/gemini-key")
      .then((r) => r.json())
      .then((data) => setState(data))
      .catch(() => setState({ configured: false, source: null }));
  }, [previewMode]);

  const save = async () => {
    if (previewMode) {
      showToast("둘러보기 모드에서는 API 키를 저장할 수 없어요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/gemini-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Gemini API 키를 저장하지 못했어요.");
        return;
      }
      setState({ configured: true, source: "saved" });
      setApiKey("");
      setEditing(false);
      showToast("Gemini API 키를 저장했어요.");
    } catch {
      setError("네트워크를 확인한 뒤 다시 저장해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const sourceDescription = state?.source === "saved"
    ? "AdFlow에 암호화해 저장돼 있어요."
    : state?.source === "env"
      ? "서버 환경변수로 설정돼 있어요. 여기서 저장하면 해당 키를 우선 사용해요."
      : "AI 카피와 이미지 생성 기능을 사용하려면 API 키를 설정해주세요.";

  return (
    <Card variant="lg" className="flex flex-col gap-0">
      <div className="flex items-center gap-[14px]">
        <div className="w-12 h-12 rounded-xl bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] grid place-items-center flex-none">
          <Icon name="sparkles" size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">Gemini API 키</h2>
            <Chip variant={state?.configured ? "success" : "warn"} size="sm" dot={!!state?.configured}>
              {state?.configured ? "설정됨" : "미설정"}
            </Chip>
          </div>
          <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">{sourceDescription}</p>
        </div>
      </div>
      <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
      {editing ? (
        <div className="flex flex-col gap-3">
          <label className="font-semibold text-[13px] text-[var(--w-fg-strong)]" htmlFor="gemini-api-key">Gemini API 키</label>
          <input
            id="gemini-api-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza…"
            className="w-full box-border px-3 py-2.5 rounded-lg border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] font-medium text-[14px] outline-none focus:border-[var(--w-primary-normal)]"
          />
          {error && <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-status-negative)]">{error}</div>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => { setEditing(false); setError(null); }} disabled={busy}>취소</Button>
            <Button variant="primary" size="sm" type="button" onClick={save} disabled={!apiKey.trim() || busy}>{busy ? "저장 중…" : "저장하기"}</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)]">API 키는 다시 표시되지 않아요.</div>
          <Button variant={state?.configured ? "secondary" : "primary"} size="sm" type="button" onClick={() => setEditing(true)}>
            {state?.configured ? "API 키 교체" : "API 키 설정"} <Icon name="arrow-right" size={13} />
          </Button>
        </div>
      )}
    </Card>
  );
}

type NotifKey = "launch" | "perf" | "weekly" | "opt" | "adStatus";
const NOTIF_OPTS: [NotifKey, string, boolean][] = [
  ["launch", "광고가 게재됐을 때", true],
  ["adStatus", "광고 상태가 바뀌었을 때 (승인·거부·이슈)", true],
  ["opt", "AI 최적화 제안이 있을 때", true],
  ["perf", "성과가 갑자기 변동했을 때", false],
  ["weekly", "주간 성과 요약", false],
];

function NotifTab() {
  const { settings, update } = useNotifSettings();
  return (
    <Card variant="lg" className="flex flex-col gap-0 max-w-[720px]">
      <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">알림</h2>
      <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">중요한 사건이 일어났을 때만 보내드려요.</p>
      <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
      {NOTIF_OPTS.map(([k, l, implemented], idx) => (
        <div key={k} className={cn("flex items-center justify-between gap-3 py-4 px-[18px] rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-elevated)]", idx > 0 && "mt-2")}>
          <div>
            <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">{l}</div>
            {!implemented && <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)] mt-0.5">준비 중</div>}
          </div>
          <Toggle on={!!settings[k]} onChange={(v) => update(k, v)} />
        </div>
      ))}
      <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)] mt-[14px] flex items-center gap-1.5">
        <Icon name="info" size={12} /> 설정이 이 브라우저에 저장돼요.
      </div>
    </Card>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on} style={{ width: 40, height: 24, borderRadius: 999, background: on ? "var(--w-primary-normal)" : "var(--w-fg-assistive)", border: "none", cursor: "pointer", position: "relative", transition: "background 160ms ease", flex: "0 0 auto" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 160ms cubic-bezier(0.16,1,0.3,1)", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

const LOCAL_KEYS = ["adflow_library_v1", "adflow_loaded_creative"];
const SESSION_KEYS = ["adflow_brand", "adflow_target", "adflow_goal", "adflow_active_tab"];

function DangerTab() {
  const router = useRouter();
  const showToast = useToast();
  const { data: session } = useSession();
  const [confirmClear, setConfirmClear] = useState(false);

  async function restartOnboarding() {
    try {
      await fetch("/api/onboarding/status", { method: "DELETE" });
    } catch {
      /* 실패해도 진행 */
    }
    try {
      localStorage.removeItem(onboardedKey(session?.user?.email));
      localStorage.removeItem("adflow:onboarding-step");
    } catch {
      /* storage 사용 불가 — 무시 */
    }
    router.push("/onboarding");
  }

  const clearLocalData = () => {
    try {
      LOCAL_KEYS.forEach((k) => {
        localStorage.removeItem(k);
        notifyScopedStorageChange("local", k);
      });
      SESSION_KEYS.forEach((k) => {
        sessionStorage.removeItem(k);
        notifyScopedStorageChange("session", k);
      });
    } catch {
      /* storage 사용 불가 — 무시 */
    }
    setConfirmClear(false);
    showToast("로컬 데이터를 삭제했어요");
  };

  return (
    <>
      <Card variant="lg" className="flex flex-col gap-0 max-w-[720px]">
        <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">계정 관리</h2>
        <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">로그아웃하거나 이 브라우저에 저장된 데이터를 정리해요.</p>
        <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
        <div className="flex items-center justify-between gap-3 py-4 px-[18px] rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-elevated)]">
          <div>
            <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">온보딩 다시 보기</div>
            <div className="font-medium text-[13px] leading-[1.4] text-[var(--w-fg-neutral)] mt-0.5">계정 연결·브랜드 프로필 설정 흐름을 처음부터 다시 진행해요.</div>
          </div>
          <Button variant="secondary" size="sm" type="button" onClick={restartOnboarding}>
            <Icon name="refresh" size={13} /> 다시 보기
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 py-4 px-[18px] rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-elevated)] mt-2">
          <div>
            <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">로그아웃</div>
            <div className="font-medium text-[13px] leading-[1.4] text-[var(--w-fg-neutral)] mt-0.5">이 기기에서 AdFlow를 종료하고 로그인 화면으로 돌아가요.</div>
          </div>
          <Button variant="secondary" size="sm" type="button" onClick={() => signOut({ callbackUrl: "/login" })}><Icon name="logout" size={14} /> 로그아웃</Button>
        </div>
        <div className="flex items-center justify-between gap-3 py-4 px-[18px] rounded-xl border bg-[var(--w-bg-elevated)] mt-2" style={{ borderColor: "rgba(255,66,66,0.20)" }}>
          <div>
            <div className="font-semibold text-[14px] leading-[1.3]" style={{ color: "var(--w-status-negative)" }}>이 브라우저의 로컬 데이터 삭제</div>
            <div className="font-medium text-[13px] leading-[1.4] text-[var(--w-fg-neutral)] mt-0.5">소재 라이브러리, 작성 중이던 입력값·미리보기 데이터를 지워요. Meta에 집행된 광고와 캠페인은 영향받지 않아요.</div>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 text-[13px] rounded-lg font-semibold leading-none cursor-pointer border border-transparent bg-[rgba(255,66,66,0.10)] text-[var(--w-status-negative)]"
            onClick={() => setConfirmClear(true)}
          >
            데이터 삭제
          </button>
        </div>
      </Card>

      {confirmClear && (
        <div
          className="fixed inset-0 z-[100] bg-[rgba(15,17,21,0.45)] dark:bg-[rgba(0,0,0,0.6)] grid place-items-center p-10 animate-[fadeIn_120ms_ease]"
          onClick={() => setConfirmClear(false)}
        >
          <div
            className="bg-[var(--w-bg-elevated)] border border-[var(--w-line-alternative)] rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.20)] max-w-[90vw] max-h-[90vh] overflow-auto animate-[popIn_140ms_ease]"
            style={{ width: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "26px 26px 8px" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,66,66,0.10)", color: "var(--w-status-negative)", display: "grid", placeItems: "center", marginBottom: 14 }}><Icon name="warn" size={20} /></div>
              <h3 style={{ font: "700 17px/1.35 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.01em", margin: 0 }}>로컬 데이터를 삭제할까요?</h3>
              <p style={{ font: "500 13.5px/1.6 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "10px 0 0" }}>소재 라이브러리에 저장한 소재도 모두 지워지고 되돌릴 수 없어요. Meta에 집행된 광고는 영향받지 않아요.</p>
            </div>
            <div className="flex gap-2 justify-end px-6 py-[18px] border-t border-[var(--w-line-alternative)] mt-5">
              <Button variant="ghost" type="button" onClick={() => setConfirmClear(false)}>취소</Button>
              <Button variant="danger" type="button" onClick={clearLocalData}>데이터 삭제</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
