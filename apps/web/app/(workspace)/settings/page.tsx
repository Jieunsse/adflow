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

type Tab = "account" | "notif" | "danger";
const TABS: [Tab, string][] = [["account", "계정 연결"], ["notif", "알림"], ["danger", "계정 관리"]];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("account");
  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label="설정">
      <div className="flex justify-between items-end gap-6">
        <div>
          <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">설정</span>
          <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]" style={{ marginTop: 4 }}>설정</h1>
          <p className="font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-neutral)] mt-1.5 mb-0">계정 연결, 알림을 관리해요.</p>
        </div>
      </div>

      <div className="inline-flex gap-0.5 p-[3px] bg-[var(--w-bg-alternative)] rounded-[10px]">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "border-none px-3.5 py-2 rounded-lg font-semibold text-[13px] leading-none cursor-pointer transition-[background,color] duration-[120ms]",
              tab === k
                ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]"
                : "bg-transparent text-[var(--w-fg-neutral)]"
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "account" && <AccountTab />}
      {tab === "notif" && <NotifTab />}
      {tab === "danger" && <DangerTab />}
    </div>
  );
}

function AccountTab() {
  const router = useRouter();
  const { data: session } = useSession();
  const connected = !!(session?.adAccountId && session?.pageId);
  const browseMode = !!session?.browseMode;

  const statusIconBg = connected
    ? "var(--w-primary-soft)"
    : browseMode
      ? "rgba(255,146,0,0.14)"
      : "rgba(255,66,66,0.10)";
  const statusIconFg = connected
    ? "var(--w-primary-press)"
    : browseMode
      ? "var(--w-status-cautionary)"
      : "var(--w-status-negative)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card variant="lg" className="flex flex-col gap-0">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: statusIconBg, color: statusIconFg, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <Icon name={connected ? "check" : "link"} size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">연결 상태</h2>
              {connected ? (
                <Chip variant="success" size="sm" dot live>연결됨</Chip>
              ) : browseMode ? (
                <Chip variant="warn" size="sm">둘러보기</Chip>
              ) : (
                <Chip variant="neg" size="sm">미연결</Chip>
              )}
            </div>
            <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">
              {connected
                ? "Meta 광고 계정과 페이스북 페이지가 연결되어 있어요."
                : browseMode
                  ? "예시 데이터로 화면과 흐름을 살펴보는 중이에요. 광고 집행은 연결 후에 가능해요."
                  : "아직 광고 계정·페이지가 연결되지 않았어요."}
            </p>
          </div>
        </div>
        <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
        {connected ? (
          <>
            <div className="flex items-center justify-between gap-3 py-4 px-[18px] rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-elevated)]">
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--w-primary-soft)", color: "var(--w-primary-press)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name="wallet" size={18} /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">{session?.adAccountName ?? "광고 계정"}</div>
                  <div className="font-medium text-[13px] leading-[1.4] text-[var(--w-fg-neutral)] mt-0.5">{session?.adAccountId}</div>
                </div>
              </div>
              <Chip variant="success" size="sm" dot>활성</Chip>
            </div>
            <div className="flex items-center justify-between gap-3 py-4 px-[18px] rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-elevated)] mt-2">
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--w-accent-violet-soft)", color: "var(--w-accent-violet)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name="doc" size={18} /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">{session?.pageName ?? "페이스북 페이지"}</div>
                  <div className="font-medium text-[13px] leading-[1.4] text-[var(--w-fg-neutral)] mt-0.5">{session?.pageId}</div>
                </div>
              </div>
              <Chip variant="success" size="sm" dot>활성</Chip>
            </div>
            <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div className="font-medium text-[12px] leading-[1.5] tracking-[0.008em] text-[var(--w-fg-neutral)]">광고 계정·페이지 변경이나 연결 해제는 계정 연결 탭에서 할 수 있어요.</div>
              <Button variant="secondary" size="sm" type="button" onClick={() => router.push("/connect")}>연결 관리 <Icon name="arrow-right" size={13} /></Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 py-4 px-[18px] rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-elevated)]" style={{ borderStyle: "dashed" }}>
            <div>
              <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">광고 계정이 연결되지 않았어요</div>
              <div className="font-medium text-[13px] leading-[1.4] text-[var(--w-fg-neutral)] mt-0.5">{browseMode ? "광고를 집행하려면 Meta 광고 계정·페이지를 연결해주세요." : "Meta 광고 계정·페이지를 연결하면 광고를 만들고 집행할 수 있어요."}</div>
            </div>
            <Button variant="primary" size="sm" type="button" onClick={() => router.push("/connect")}><Icon name="link" size={14} /> 계정 연결하기</Button>
          </div>
        )}
      </Card>

      {connected && (
        <Card className="flex items-center gap-[18px] flex-wrap" style={{ background: "linear-gradient(135deg, rgba(0,102,255,0.04), rgba(101,65,242,0.05))", borderColor: "transparent" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--w-primary-soft)", color: "var(--w-primary-press)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <Icon name="sparkles" size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div className="font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">광고를 만들 수 있어요</div>
              <Chip variant="success" size="sm" dot live>준비됨</Chip>
            </div>
            <p style={{ font: "500 13px/1.55 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "6px 0 0" }}>바로 광고 만들기 화면으로 이동해 첫 캠페인을 시작해보세요.</p>
          </div>
          <Button variant="primary" size="sm" type="button" onClick={() => router.push("/create")}>광고 만들기로 이동 <Icon name="arrow-right" size={13} /></Button>
        </Card>
      )}

      {(session?.role === "팀장" || browseMode) && <MetaAppCard previewMode={browseMode} />}

      <Card variant="lg" className="flex flex-col gap-0">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <Icon name="image" size={22} style={{ color: "#fff" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="m-0 font-bold text-[17px] leading-[1.3] tracking-[-0.012em] text-[var(--w-fg-strong)]">Instagram 오가닉 인사이트</h2>
            <p className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1 mb-0">연결된 Facebook 페이지에 Instagram 비즈니스 계정이 링크되면 성과 탭에서 오가닉 인사이트를 자동으로 확인할 수 있어요.</p>
          </div>
        </div>
        <hr className="h-px bg-[var(--w-line-neutral)] my-[18px] border-0" />
        <div className="flex items-center justify-between gap-3 py-4 px-[18px] rounded-xl border border-[var(--w-line-alternative)] bg-[var(--w-bg-elevated)]">
          <div style={{ minWidth: 0 }}>
            <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">Instagram 비즈니스 계정</div>
            <div className="font-medium text-[13px] leading-[1.4] text-[var(--w-fg-neutral)] mt-0.5">
              {connected
                ? "Facebook 페이지에 Instagram 비즈니스 계정이 연결되면 자동으로 인사이트를 불러와요."
                : "먼저 Meta 광고 계정과 Facebook 페이지를 연결해주세요."}
            </div>
          </div>
          <Button variant="secondary" size="sm" type="button" onClick={() => router.push("/create")}>
            성과 탭에서 확인 <Icon name="arrow-right" size={13} />
          </Button>
        </div>
        <div className="flex items-start gap-2.5 p-3 px-[14px] rounded-[10px] border bg-[rgba(0,102,255,0.06)] border-[rgba(0,102,255,0.18)] text-[var(--w-primary-press)] mt-[14px] font-medium text-[13px] leading-[1.5]">
          <Icon name="info" size={14} style={{ flex: "0 0 auto", marginTop: 2 }} />
          <span>Instagram 비즈니스 계정 연결은 Facebook 페이지 설정에서 할 수 있어요. 연결 후 다시 로그인하면 인사이트가 활성화돼요.</span>
        </div>
      </Card>
    </div>
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
