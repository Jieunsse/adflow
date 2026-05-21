"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import IdField from "@shared/ui/IdField";
import { Badge } from "@shared/ui/primitives";
import { useToast } from "@shared/ui/Toast";
import { useNotifSettings } from "@shared/lib/notifications";
import { notifyScopedStorageChange } from "@shared/lib/storage/useScopedStorage";

type Tab = "account" | "notif" | "danger";
const TABS: [Tab, string][] = [["account", "계정 연결"], ["notif", "알림"], ["danger", "계정 관리"]];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("account");
  return (
    <div className="page" data-screen-label="설정">
      <div className="page__head">
        <div>
          <span className="w-overline" style={{ color: "var(--w-fg-neutral)" }}>설정</span>
          <h1 className="page__title" style={{ marginTop: 4 }}>설정</h1>
          <p className="page__sub">계정 연결, 알림을 관리해요.</p>
        </div>
      </div>

      <div className="seg">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
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
      <div className="card card--lg">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: statusIconBg, color: statusIconFg, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <Icon name={connected ? "check" : "link"} size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 className="section-title">연결 상태</h2>
              {connected ? (
                <Badge kind="success" size="sm" dot live>연결됨</Badge>
              ) : browseMode ? (
                <Badge kind="warn" size="sm">둘러보기</Badge>
              ) : (
                <Badge kind="neg" size="sm">미연결</Badge>
              )}
            </div>
            <p className="section-sub">
              {connected
                ? "Meta 광고 계정과 페이스북 페이지가 연결되어 있어요."
                : browseMode
                  ? "예시 데이터로 화면과 흐름을 살펴보는 중이에요. 광고 집행은 연결 후에 가능해요."
                  : "아직 광고 계정·페이지가 연결되지 않았어요."}
            </p>
          </div>
        </div>
        <hr className="divider" />
        {connected ? (
          <>
            <div className="list-row">
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--w-primary-soft)", color: "var(--w-primary-press)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name="wallet" size={18} /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="list-row__title">{session?.adAccountName ?? "광고 계정"}</div>
                  <div className="list-row__sub">{session?.adAccountId}</div>
                </div>
              </div>
              <Badge kind="success" size="sm" dot>활성</Badge>
            </div>
            <div className="list-row">
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--w-accent-violet-soft)", color: "var(--w-accent-violet)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name="doc" size={18} /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="list-row__title">{session?.pageName ?? "페이스북 페이지"}</div>
                  <div className="list-row__sub">{session?.pageId}</div>
                </div>
              </div>
              <Badge kind="success" size="sm" dot>활성</Badge>
            </div>
            <hr className="divider" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div className="field__hint">광고 계정·페이지 변경이나 연결 해제는 계정 연결 탭에서 할 수 있어요.</div>
              <button className="btn btn--secondary btn--sm" type="button" onClick={() => router.push("/connect")}>연결 관리 <Icon name="arrow-right" size={13} /></button>
            </div>
          </>
        ) : (
          <div className="list-row" style={{ borderStyle: "dashed" }}>
            <div>
              <div className="list-row__title">광고 계정이 연결되지 않았어요</div>
              <div className="list-row__sub">{browseMode ? "광고를 집행하려면 Meta 광고 계정·페이지를 연결해주세요." : "Meta 광고 계정·페이지를 연결하면 광고를 만들고 집행할 수 있어요."}</div>
            </div>
            <button className="btn btn--primary btn--sm" type="button" onClick={() => router.push("/connect")}><Icon name="link" size={14} /> 계정 연결하기</button>
          </div>
        )}
      </div>

      {connected && (
        <div className="card" style={{ background: "linear-gradient(135deg, rgba(0,102,255,0.04), rgba(101,65,242,0.05))", borderColor: "transparent", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--w-primary-soft)", color: "var(--w-primary-press)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <Icon name="sparkles" size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ font: "700 17px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", letterSpacing: "-0.012em" }}>광고를 만들 수 있어요</div>
              <Badge kind="success" size="sm" dot live>준비됨</Badge>
            </div>
            <p style={{ font: "500 13px/1.55 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "6px 0 0" }}>바로 광고 만들기 화면으로 이동해 첫 캠페인을 시작해보세요.</p>
          </div>
          <button className="btn btn--primary btn--sm" type="button" onClick={() => router.push("/create")}>광고 만들기로 이동 <Icon name="arrow-right" size={13} /></button>
        </div>
      )}

      {(session?.role === "팀장" || browseMode) && <MetaAppCard previewMode={browseMode} />}

      <div className="card card--lg">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <Icon name="image" size={22} style={{ color: "#fff" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="section-title">Instagram 오가닉 인사이트</h2>
            <p className="section-sub">연결된 Facebook 페이지에 Instagram 비즈니스 계정이 링크되면 성과 탭에서 오가닉 인사이트를 자동으로 확인할 수 있어요.</p>
          </div>
        </div>
        <hr className="divider" />
        <div className="list-row">
          <div style={{ minWidth: 0 }}>
            <div className="list-row__title">Instagram 비즈니스 계정</div>
            <div className="list-row__sub">
              {connected
                ? "Facebook 페이지에 Instagram 비즈니스 계정이 연결되면 자동으로 인사이트를 불러와요."
                : "먼저 Meta 광고 계정과 Facebook 페이지를 연결해주세요."}
            </div>
          </div>
          <button className="btn btn--secondary btn--sm" type="button" onClick={() => router.push("/create")}>
            성과 탭에서 확인 <Icon name="arrow-right" size={13} />
          </button>
        </div>
        <div className="callout callout--info" style={{ marginTop: 14, font: "500 12.5px/1.5 var(--w-font-sans)" }}>
          <Icon name="info" size={14} style={{ flex: "0 0 auto", marginTop: 2 }} />
          <span>Instagram 비즈니스 계정 연결은 Facebook 페이지 설정에서 할 수 있어요. 연결 후 다시 로그인하면 인사이트가 활성화돼요.</span>
        </div>
      </div>
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
    <div className="card card--lg">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--w-accent-violet-soft)", color: "var(--w-accent-violet)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
          <Icon name="settings" size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 className="section-title">Meta 앱 연결</h2>
            <Badge kind={previewMode ? "warn" : "violet"} size="sm">{previewMode ? "둘러보기" : "관리자"}</Badge>
          </div>
          <p className="section-sub">
            {previewMode
              ? "Meta 개발자센터 가입부터 라이브 전환까지의 연결 과정을 미리 둘러볼 수 있어요. 저장은 되지 않아요."
              : "AdFlow가 Meta 광고 API를 호출할 때 사용하는 앱 자격증명이에요. 교체하면 모든 사용자가 다시 로그인해야 해요."}
          </p>
        </div>
      </div>
      <hr className="divider" />
      {loading ? (
        <div className="field__hint">불러오는 중…</div>
      ) : state?.configured ? (
        <>
          <IdField
            label="App ID"
            id={state.clientId}
            desc="AdFlow가 Meta 광고 API를 호출할 때 사용하는 앱 고유 식별자."
          />
          <hr className="divider" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div className="field__hint">
              {lastChange
                ? `마지막 변경: ${new Date(lastChange.timestamp).toLocaleString("ko-KR")} · ${lastChange.actor}`
                : "변경 이력이 없어요."}
            </div>
            <button className="btn btn--secondary btn--sm" type="button" onClick={() => router.push(installHref)}>
              {previewMode ? "연결하기" : "자격증명 교체"} <Icon name="arrow-right" size={13} />
            </button>
          </div>
        </>
      ) : (
        <div className="list-row" style={{ borderStyle: "dashed" }}>
          <div>
            <div className="list-row__title">Meta 앱이 연결되지 않았어요</div>
            <div className="list-row__sub">로그인이 동작하려면 Meta 앱 자격증명을 먼저 등록해야 해요.</div>
          </div>
          <button className="btn btn--primary btn--sm" type="button" onClick={() => router.push("/install")}>
            <Icon name="link" size={14} /> 셋업 시작
          </button>
        </div>
      )}
    </div>
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
    <div className="card card--lg" style={{ maxWidth: 720 }}>
      <h2 className="section-title">알림</h2>
      <p className="section-sub">중요한 사건이 일어났을 때만 보내드려요.</p>
      <hr className="divider" />
      {NOTIF_OPTS.map(([k, l, implemented]) => (
        <div key={k} className="list-row">
          <div>
            <div className="list-row__title">{l}</div>
            {!implemented && <div className="field__hint" style={{ marginTop: 2 }}>준비 중</div>}
          </div>
          <Toggle on={!!settings[k]} onChange={(v) => update(k, v)} />
        </div>
      ))}
      <div className="field__hint" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name="info" size={12} /> 설정이 이 브라우저에 저장돼요.
      </div>
    </div>
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
  const showToast = useToast();
  const [confirmClear, setConfirmClear] = useState(false);

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
      <div className="card card--lg" style={{ maxWidth: 720 }}>
        <h2 className="section-title">계정 관리</h2>
        <p className="section-sub">로그아웃하거나 이 브라우저에 저장된 데이터를 정리해요.</p>
        <hr className="divider" />
        <div className="list-row">
          <div>
            <div className="list-row__title">로그아웃</div>
            <div className="list-row__sub">이 기기에서 AdFlow를 종료하고 로그인 화면으로 돌아가요.</div>
          </div>
          <button className="btn btn--secondary btn--sm" type="button" onClick={() => signOut({ callbackUrl: "/login" })}><Icon name="logout" size={14} /> 로그아웃</button>
        </div>
        <div className="list-row" style={{ borderColor: "rgba(255,66,66,0.20)" }}>
          <div>
            <div className="list-row__title" style={{ color: "var(--w-status-negative)" }}>이 브라우저의 로컬 데이터 삭제</div>
            <div className="list-row__sub">소재 라이브러리, 작성 중이던 입력값·미리보기 데이터를 지워요. Meta에 집행된 광고와 캠페인은 영향받지 않아요.</div>
          </div>
          <button className="btn btn--sm" type="button" style={{ background: "rgba(255,66,66,0.10)", color: "var(--w-status-negative)" }} onClick={() => setConfirmClear(true)}>데이터 삭제</button>
        </div>
      </div>

      {confirmClear && (
        <div className="modal-overlay" onClick={() => setConfirmClear(false)}>
          <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "26px 26px 8px" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,66,66,0.10)", color: "var(--w-status-negative)", display: "grid", placeItems: "center", marginBottom: 14 }}><Icon name="warn" size={20} /></div>
              <h3 style={{ font: "700 17px/1.35 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.01em", margin: 0 }}>로컬 데이터를 삭제할까요?</h3>
              <p style={{ font: "500 13.5px/1.6 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "10px 0 0" }}>소재 라이브러리에 저장한 소재도 모두 지워지고 되돌릴 수 없어요. Meta에 집행된 광고는 영향받지 않아요.</p>
            </div>
            <div className="modal__foot">
              <button className="btn btn--ghost" type="button" onClick={() => setConfirmClear(false)}>취소</button>
              <button className="btn btn--danger" type="button" onClick={clearLocalData}>데이터 삭제</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
