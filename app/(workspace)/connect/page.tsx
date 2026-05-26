"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Icon, { type IconName } from "@shared/ui/Icon";
import { useToast } from "@shared/ui/Toast";
import ConfirmModal from "@shared/ui/ConfirmModal";
import IdField from "@shared/ui/IdField";
import { maskId } from "@shared/lib/format";
import { Button, buttonVariants } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Skeleton } from "@shared/ui/Skeleton";
import { cn } from "@shared/lib/cn";

type AccountInfo = { connected: boolean; accountId: string; accountName: string; currency: string };

async function applyIgToken({ update, showToast, onSuccess }: {
  update: (data: Record<string, unknown>) => Promise<unknown>;
  showToast: (msg: string) => void;
  onSuccess?: () => void;
}) {
  try {
    const r = await fetch("/api/instagram/token");
    const data = await r.json() as { igAccessToken?: string; igUserId?: string; igUsername?: string; error?: string };
    console.log("[IG connect] token response:", r.status, data.error ?? (data.igAccessToken ? "token ok" : "no token"));
    if (!r.ok || !data.igAccessToken) {
      showToast(`토큰 저장 실패 (${r.status}) — ${data.error ?? "토큰 없음"}`);
      return false;
    }
    const newSession = await update({ igAccessToken: data.igAccessToken, igUserId: data.igUserId, igUsername: data.igUsername });
    console.log("[IG] update result:", (newSession as Record<string, unknown>)?.igAccessToken ? "igAccessToken present" : "igAccessToken MISSING", newSession);
    showToast("Instagram 게시 권한이 연결됐어요");
    onSuccess?.();
    return true;
  } catch (e) {
    showToast(`토큰 요청 오류 — ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

async function fetchAccount(): Promise<AccountInfo> {
  const res = await fetch("/api/account");
  const data = await res.json();
  if (res.status === 401) throw Object.assign(new Error(data?.error ?? "Meta 인증이 만료됐어요. 다시 로그인해주세요."), { code: 401 });
  if (!res.ok) throw new Error(data?.error ?? "연결 정보를 불러오지 못했어요");
  return data as AccountInfo;
}

type ProfilePictures = { pagePicture: string | null; igPicture: string | null };

async function fetchProfilePictures(): Promise<ProfilePictures> {
  const res = await fetch("/api/connect/profile-pictures");
  if (!res.ok) return { pagePicture: null, igPicture: null };
  return res.json();
}

type PickerKind = "account" | "page" | "pixel";
type PickerItem = {
  id: string;
  name: string;
  currency?: string;
  status?: "active" | "disabled";
  igUserId?: string | null;
  igUsername?: string | null;
};

async function fetchPickerList(kind: PickerKind): Promise<PickerItem[]> {
  const url = kind === "account" ? "/api/setup/ad-accounts" : kind === "page" ? "/api/setup/pages" : "/api/setup/pixels";
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(data?.error ?? "목록을 불러오지 못했어요");
  if (kind === "account") {
    return ((data.accounts ?? []) as { id: string; name: string; currency: string; account_status: number }[]).map((a) => ({
      id: a.id, name: a.name, currency: a.currency, status: a.account_status === 1 ? "active" : "disabled",
    }));
  }
  if (kind === "pixel") {
    return ((data.pixels ?? []) as { id: string; name: string }[]).map((p) => ({ id: p.id, name: p.name }));
  }
  return ((data.pages ?? []) as { id: string; name: string; igUserId: string | null; igUsername: string | null }[]).map((p) => ({
    id: p.id, name: p.name, igUserId: p.igUserId, igUsername: p.igUsername,
  }));
}

function connCardClass(tone: "neutral" | "warn" | "danger" | "muted") {
  const border = tone === "warn" ? "border-[rgba(255,146,0,0.42)]" : tone === "danger" ? "border-[rgba(255,66,66,0.42)]" : "border-[var(--w-line-normal)]";
  const bg = tone === "muted" ? "bg-[var(--w-bg-alternative)]" : "bg-[var(--w-bg-elevated)]";
  return `flex gap-[18px] items-start p-[22px] ${bg} border ${border} rounded-[14px] dark:shadow-[var(--w-shadow-card)]`;
}

export default function ConnectPage() {
  const router = useRouter();
  const showToast = useToast();
  const { data: session, update } = useSession();
  const queryClient = useQueryClient();
  const [permsOpen, setPermsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<PickerKind | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [reauthing, setReauthing] = useState(false);
  const [applyingToken, setApplyingToken] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    console.log("[IG connect] search:", window.location.search, "igLinked:", params.get("igLinked"));
    if (params.get("igLinked") === "1") {
      window.history.replaceState({}, "", "/connect");
      applyIgToken({ update, showToast, onSuccess: () => window.location.reload() });
    }
    if (params.get("igError")) {
      window.history.replaceState({}, "", "/connect");
      showToast("Instagram 연결에 실패했어요. 다시 시도해주세요.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = !!(session?.adAccountId && session?.pageId);
  const isExploring = !!session?.browseMode && !connected;

  const accountQ = useQuery({ queryKey: ["account"], queryFn: fetchAccount, enabled: connected });
  const picturesQ = useQuery({
    queryKey: ["profile-pictures", session?.pageId, session?.igUserId],
    queryFn: fetchProfilePictures,
    enabled: connected,
    staleTime: 5 * 60 * 1000,
  });
  const tokenExpired = (accountQ.error as { code?: number } | null)?.code === 401;
  const accountStatus: "active" | "disabled" = accountQ.data && accountQ.data.connected === false ? "disabled" : "active";

  const memberName = session?.user?.name ?? "";
  const memberImage = session?.user?.image ?? null;
  const accountName = session?.adAccountName ?? accountQ.data?.accountName ?? "—";
  const accountId = session?.adAccountId ?? accountQ.data?.accountId ?? "—";
  const currency = accountQ.data?.currency ?? "—";
  const pageName = session?.pageName ?? "—";
  const pageId = session?.pageId ?? "—";
  const pixelName = session?.pixelName ?? null;
  const pixelId = session?.pixelId ?? null;
  const igUserId = session?.igUserId || null;
  const igUsername = session?.igUsername || null;

  const handleReauth = () => { setReauthing(true); signIn("facebook", { callbackUrl: "/connect" }); };
  const handleDisconnect = () => { signOut({ callbackUrl: "/login" }); };

  const pickAccount = async (it: PickerItem) => {
    await update?.({ adAccountId: it.id, adAccountName: it.name });
    setPickerOpen(null);
    showToast(`'${it.name}'(으)로 변경했어요`);
    accountQ.refetch();
  };
  const pickPage = async (it: PickerItem) => {
    await update?.({
      pageId: it.id,
      pageName: it.name,
      igUserId: it.igUserId ?? "",
      igUsername: it.igUsername ?? "",
    });
    setPickerOpen(null);
    showToast(`'${it.name}'(으)로 변경했어요`);
  };
  const pickPixel = async (it: PickerItem) => {
    await update?.({ pixelId: it.id, pixelName: it.name });
    setPickerOpen(null);
    showToast(`'${it.name}'(으)로 변경했어요`);
  };

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label="계정 연결">
      <div className="flex justify-between items-end gap-6">
        <div>
          <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">워크스페이스 · 계정 연결</span>
          <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]" style={{ marginTop: 4 }}>Meta 광고 계정 연결</h1>
          <p className="font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-neutral)] mt-1.5 mb-0">AdFlow가 어떤 Meta 광고 계정·페이스북 페이지에 연결돼 있는지 보고, 바꾸고, 끊을 수 있어요.</p>
        </div>
      </div>

      {isExploring && (
        <div className="flex items-center gap-3 p-[12px_16px] bg-[linear-gradient(90deg,rgba(0,102,255,0.06),rgba(101,65,242,0.06))] border border-[rgba(0,102,255,0.20)] rounded-xl mb-4">
          <div className="w-8 h-8 rounded-[9px] bg-[var(--w-bg-elevated)] text-[var(--w-primary-press)] grid place-items-center flex-none border border-[var(--w-line-alternative)]"><Icon name="info" size={16} /></div>
          <div style={{ flex: 1 }}>
            <div className="font-bold text-[13px] leading-[1.3] text-[var(--w-fg-strong)]">둘러보기 중</div>
            <div className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)] mt-0.5">계정을 연결하면 실제 광고 집행과 성과 추적이 가능해요.</div>
          </div>
        </div>
      )}

      {!connected ? (
        <UnconnectedCTA onConnect={() => router.push("/setup")} />
      ) : accountQ.isLoading ? (
        <ConnectSkeleton />
      ) : accountQ.isError && !tokenExpired ? (
        <ErrorCard
          title="연결 정보를 불러오지 못했어요"
          reason={accountQ.error instanceof Error ? accountQ.error.message : "Meta API 응답이 지연되거나 일시적 네트워크 오류일 수 있어요. 잠시 후 다시 시도해 주세요."}
          onRetry={() => accountQ.refetch()}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FacebookCard memberName={memberName} memberImage={memberImage} tokenExpired={tokenExpired} reauthing={reauthing} onReauth={handleReauth} />
          <AdAccountCard name={accountName} id={accountId} currency={currency} status={tokenExpired ? null : accountStatus} disabled={tokenExpired} onChange={() => setPickerOpen("account")} />
          <PageCard name={pageName} id={pageId} picture={picturesQ.data?.pagePicture ?? null} disabled={tokenExpired} onChange={() => setPickerOpen("page")} />
          <InstagramCard
            username={igUsername}
            id={igUserId}
            picture={picturesQ.data?.igPicture ?? null}
            pageId={session?.pageId ?? null}
            igAccessToken={session?.igAccessToken ?? null}
            disabled={tokenExpired}
            applyingToken={applyingToken}
            onApplyToken={async () => {
              setApplyingToken(true);
              await applyIgToken({ update, showToast, onSuccess: () => window.location.reload() });
              setApplyingToken(false);
            }}
            onReload={() => {
              queryClient.invalidateQueries({ queryKey: ["picker-list", "page"] });
              setPickerOpen("page");
            }}
          />
          <PixelCard name={pixelName} id={pixelId} disabled={tokenExpired} onChange={() => setPickerOpen("pixel")} />

          <PermissionsDisclosure open={permsOpen} onToggle={() => setPermsOpen((o) => !o)} />

          <div className="flex items-center gap-4 px-[22px] py-[18px] bg-[rgba(255,66,66,0.04)] dark:bg-[rgba(255,66,66,0.06)] border border-[rgba(255,66,66,0.20)] rounded-[14px] mt-1">
            <div style={{ flex: 1 }}>
              <div className="font-bold text-[14px] leading-[1.3] text-[var(--w-status-negative)]">Meta 연결 해제</div>
              <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1">해제하면 캠페인 성과 조회·게재 제어가 멈춰요. 다시 연결하려면 로그아웃 후 Facebook으로 다시 로그인하면 돼요.</div>
            </div>
            <Button variant="danger" type="button" onClick={() => setConfirmDisconnect(true)}>
              <Icon name="link" size={14} /> 연결 해제
            </Button>
          </div>
        </div>
      )}

      {pickerOpen === "account" && (
        <PickerModal kind="account" title="광고 계정 변경" subtitle="이 워크스페이스에서 사용할 Meta 광고 계정을 골라주세요." currentId={session?.adAccountId} onClose={() => setPickerOpen(null)} onPick={pickAccount} />
      )}
      {pickerOpen === "page" && (
        <PickerModal kind="page" title="페이스북 페이지 변경" subtitle="광고가 어느 페이지 명의로 게재될지 골라주세요." currentId={session?.pageId} onClose={() => setPickerOpen(null)} onPick={pickPage} />
      )}
      {pickerOpen === "pixel" && (
        <PickerModal kind="pixel" title="Facebook Pixel 선택" subtitle="광고 성과 추적에 사용할 Pixel을 골라주세요. 없으면 건너뛰어도 돼요." currentId={session?.pixelId} onClose={() => setPickerOpen(null)} onPick={pickPixel} />
      )}
      {confirmDisconnect && (
        <ConfirmModal
          title="Meta 연결을 해제할까요?"
          desc="해제하면 집행 중인 캠페인의 성과·제어를 AdFlow에서 볼 수 없고, 다시 연결하기 전엔 새 광고를 게재할 수 없어요. 이미 Meta에 올라간 광고 자체는 Meta에서 계속 돌아갑니다. (로그아웃되며, 다시 연결하려면 Facebook으로 다시 로그인하면 돼요.)"
          confirmLabel="연결 해제"
          tone="danger"
          onClose={() => setConfirmDisconnect(false)}
          onConfirm={handleDisconnect}
        />
      )}
    </div>
  );
}

function FacebookCard({ memberName, memberImage, tokenExpired, reauthing, onReauth }: {
  memberName: string; memberImage: string | null; tokenExpired: boolean; reauthing: boolean; onReauth: () => void;
}) {
  return (
    <div className={connCardClass(tokenExpired ? "danger" : "neutral")}>
      <div className="w-12 h-12 rounded-xl grid place-items-center flex-none bg-[#1877F2] text-white"><Icon name="facebook" size={26} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="font-bold text-[16.5px] leading-[1.35] [font-family:var(--w-font-display)] text-[var(--w-fg-strong)] tracking-[-0.012em]">{tokenExpired ? "Meta 인증이 만료됐어요" : "Facebook에 연결됨"}</div>
            <div className="flex items-center gap-2 flex-wrap font-medium text-[12.5px] leading-none text-[var(--w-fg-neutral)] mt-2">
              {memberImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={memberImage} alt="" className="w-5 h-5 rounded-full text-white grid place-items-center font-bold text-[10px] leading-none [font-family:var(--w-font-display)]" style={{ objectFit: "cover" }} />
              ) : (
                <span className="w-5 h-5 rounded-full text-white grid place-items-center font-bold text-[10px] leading-none [font-family:var(--w-font-display)]" style={{ background: "#0066ff" }}>{(memberName.trim()[0] ?? "?").toUpperCase()}</span>
              )}
              <span>{memberName ? `${memberName}님이 연결` : "Facebook 계정으로 연결됨"}</span>
              <span className="w-[3px] h-[3px] rounded-full bg-[var(--w-fg-alternative)]" />
              <span className="font-medium text-[12px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-alternative)]">장기 액세스 토큰 (약 60일)</span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 items-end flex-none">
            {tokenExpired
              ? <span className="inline-flex items-center gap-[5px] px-2.5 py-1 rounded-full font-semibold text-[12px] leading-none text-[var(--w-status-negative)] bg-[rgba(255,66,66,0.12)]"><Icon name="warn" size={12} /> 인증 만료</span>
              : <span className="inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full font-semibold text-[11.5px] leading-none text-[var(--w-status-positive)] bg-[rgba(0,191,64,0.10)] dark:bg-[rgba(73,229,125,0.14)] dark:text-[#49e57d]"><span className="w-1.5 h-1.5 rounded-full bg-[var(--w-status-positive)] dark:bg-[#49e57d]" /> 정상</span>}
          </div>
        </div>
        {tokenExpired && (
          <div className={cn("flex items-center gap-2.5 p-[10px_12px] rounded-[10px] font-medium text-[12.5px] leading-[1.5] mt-3.5", "bg-[rgba(255,66,66,0.08)] border border-[rgba(255,66,66,0.22)] text-[var(--w-status-negative)]")}>
            <Icon name="warn" size={14} />
            <span style={{ flex: 1 }}><strong>Meta 인증이 만료됐어요.</strong> 재인증해야 광고 집행과 성과 조회를 다시 할 수 있어요.</span>
            <Button variant="danger" size="sm" type="button" onClick={onReauth} disabled={reauthing}><Icon name="refresh" size={13} /> {reauthing ? "이동 중…" : "재인증"}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AdAccountCard({ name, id, currency, status, disabled, onChange }: {
  name: string; id: string; currency: string; status: "active" | "disabled" | null; disabled: boolean; onChange: () => void;
}) {
  const tone = status === "disabled" ? "warn" : disabled ? "muted" : "neutral";
  return (
    <div className={connCardClass(tone)}>
      <div className="w-12 h-12 rounded-xl grid place-items-center flex-none bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] dark:bg-[rgba(0,102,255,0.18)] dark:text-[#6ea7ff]"><Icon name="wallet" size={22} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-4">
          <div style={{ minWidth: 0 }}>
            <div className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]" style={{ color: "var(--w-fg-alternative)", marginBottom: 6 }}>광고 계정</div>
            <div className="font-bold text-[16.5px] leading-[1.35] [font-family:var(--w-font-display)] tracking-[-0.012em]" style={{ color: disabled ? "var(--w-fg-neutral)" : "var(--w-fg-strong)" }}>{name}</div>
            {currency !== "—" && (
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className="font-medium text-[12.5px] leading-none [font-family:var(--w-font-mono)] text-[var(--w-fg-neutral)]">{currency}</span>
              </div>
            )}
            <div className="mt-4 mb-1.5">
              <IdField
                label="광고 계정 ID"
                id={id}
                desc="Meta 광고 계정의 고유 번호. 결제·문의 시 Meta에 알려주는 값이에요."
              />
            </div>
          </div>
          <div className="flex flex-col gap-2.5 items-end flex-none">
            {status === "disabled"
              ? <span className="inline-flex items-center gap-[5px] px-2.5 py-1 rounded-full font-semibold text-[12px] leading-none text-[var(--w-status-cautionary)] bg-[rgba(255,146,0,0.12)]"><Icon name="warn" size={12} /> 비활성·정지</span>
              : status === "active"
                ? <span className="inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full font-semibold text-[11.5px] leading-none text-[var(--w-status-positive)] bg-[rgba(0,191,64,0.10)] dark:bg-[rgba(73,229,125,0.14)] dark:text-[#49e57d]"><span className="w-1.5 h-1.5 rounded-full bg-[var(--w-status-positive)] dark:bg-[#49e57d]" /> 활성</span>
                : null}
          </div>
        </div>
        {status === "disabled" && (
          <div className={cn("flex items-center gap-2.5 p-[10px_12px] rounded-[10px] font-medium text-[12.5px] leading-[1.5] mt-3.5", "bg-[rgba(255,146,0,0.10)] border border-[rgba(255,146,0,0.24)] text-[var(--w-status-cautionary)]")}>
            <Icon name="warn" size={14} />
            <span>이 광고 계정이 <strong>비활성/정지</strong> 상태예요. Meta 광고 관리자에서 결제·정책 위반 등을 확인해 주세요.</span>
          </div>
        )}
        {disabled && (
          <div className={cn("flex items-center gap-2.5 p-[10px_12px] rounded-[10px] font-medium text-[12.5px] leading-[1.5] mt-3.5", "bg-[var(--w-bg-alternative)] text-[var(--w-fg-alternative)] border border-[var(--w-line-alternative)]")}>
            <Icon name="lock" size={13} />
            <span>재인증 후 확인할 수 있어요.</span>
          </div>
        )}
        {!disabled && (
          <div className="flex justify-end mt-3.5">
            <Button variant="secondary" size="sm" type="button" onClick={onChange}>광고 계정 변경</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PixelCard({ name, id, disabled, onChange }: { name: string | null; id: string | null; disabled: boolean; onChange: () => void }) {
  return (
    <div className={connCardClass(disabled ? "muted" : "neutral")}>
      <div className="w-12 h-12 rounded-xl grid place-items-center flex-none bg-[rgba(101,65,242,0.14)] text-[var(--w-accent-violet)] dark:bg-[rgba(101,65,242,0.22)] dark:text-[#b9a4ff]"><Icon name="chart" size={20} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-4">
          <div style={{ minWidth: 0 }}>
            <div className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]" style={{ color: "var(--w-fg-alternative)", marginBottom: 6 }}>
              Facebook Pixel <span style={{ font: "500 11px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)", verticalAlign: "middle" }}>(선택)</span>
            </div>
            <div className="font-bold text-[16.5px] leading-[1.35] [font-family:var(--w-font-display)] tracking-[-0.012em]" style={{ color: disabled ? "var(--w-fg-neutral)" : "var(--w-fg-strong)" }}>{name ?? "선택 안 됨"}</div>
            <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)]" style={{ marginTop: 6 }}>
              {name ? "광고 클릭 후 사이트 방문을 이 Pixel로 추적해요." : "선택하면 광고 클릭 후 사이트 방문을 추적할 수 있어요. 없으면 건너뛰어도 돼요."}
            </div>
            {id && (
              <IdField
                label="Pixel ID"
                id={id}
                desc="사이트 방문 추적에 쓰이는 Meta Pixel 식별자."
              />
            )}
          </div>
        </div>
        {disabled && (
          <div className={cn("flex items-center gap-2.5 p-[10px_12px] rounded-[10px] font-medium text-[12.5px] leading-[1.5] mt-3.5", "bg-[var(--w-bg-alternative)] text-[var(--w-fg-alternative)] border border-[var(--w-line-alternative)]")}>
            <Icon name="lock" size={13} />
            <span>재인증 후 확인할 수 있어요.</span>
          </div>
        )}
        {!disabled && (
          <div className="flex justify-end mt-3.5">
            <Button variant="secondary" size="sm" type="button" onClick={onChange}>{name ? "Pixel 변경" : "Pixel 선택"}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PageCard({ name, id, picture, disabled, onChange }: { name: string; id: string; picture: string | null; disabled: boolean; onChange: () => void }) {
  return (
    <div className={connCardClass(disabled ? "muted" : "neutral")}>
      {picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picture} alt="" className="w-12 h-12 rounded-xl flex-none" style={{ objectFit: "cover", background: "var(--w-bg-alternative)" }} />
      ) : (
        <div className="w-12 h-12 rounded-xl grid place-items-center flex-none bg-[rgba(101,65,242,0.14)] text-[var(--w-accent-violet)] dark:bg-[rgba(101,65,242,0.22)] dark:text-[#b9a4ff]"><Icon name="doc" size={20} /></div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-4">
          <div style={{ minWidth: 0 }}>
            <div className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]" style={{ color: "var(--w-fg-alternative)", marginBottom: 6 }}>페이스북 페이지</div>
            <div className="font-bold text-[16.5px] leading-[1.35] [font-family:var(--w-font-display)] tracking-[-0.012em]" style={{ color: disabled ? "var(--w-fg-neutral)" : "var(--w-fg-strong)" }}>{name}</div>
            <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)]" style={{ marginTop: 6 }}>광고가 이 페이지 명의로 게재돼요.</div>
            <div className="mt-4 mb-1.5">
              <IdField
                label="페이지 ID"
                id={id}
                desc="광고가 게재되는 페이스북 페이지의 고유 번호."
              />
            </div>
          </div>
        </div>
        {disabled && (
          <div className={cn("flex items-center gap-2.5 p-[10px_12px] rounded-[10px] font-medium text-[12.5px] leading-[1.5] mt-3.5", "bg-[var(--w-bg-alternative)] text-[var(--w-fg-alternative)] border border-[var(--w-line-alternative)]")}>
            <Icon name="lock" size={13} />
            <span>재인증 후 확인할 수 있어요.</span>
          </div>
        )}
        {!disabled && (
          <div className="flex justify-end mt-3.5">
            <Button variant="secondary" size="sm" type="button" onClick={onChange}>페이지 변경</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PermCheck({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-[5px] font-semibold text-[12.5px] leading-none text-[var(--w-status-positive)] dark:text-[#49e57d]">
      <span className="inline-grid place-items-center w-[14px] h-[14px] rounded-full bg-[var(--w-status-positive)] text-white dark:bg-[#49e57d] dark:text-[#0b1c12]">
        <Icon name="check" size={9} strokeWidth={3.5} />
      </span>
      {label}
    </span>
  );
}

function InstagramCard({ username, id, picture, pageId, igAccessToken, disabled, applyingToken, onApplyToken, onReload }: {
  username: string | null; id: string | null; picture: string | null; pageId: string | null; igAccessToken: string | null; disabled: boolean; applyingToken: boolean; onApplyToken: () => void; onReload: () => void;
}) {
  const linked = !!id;
  const insightsAuthorized = !!igAccessToken;
  const publishAuthorized = !!igAccessToken;
  const linkInstagramUrl = pageId
    ? `https://www.facebook.com/${pageId}/settings/?tab=linked_accounts`
    : "https://accountscenter.facebook.com/connected_experiences";
  return (
    <div className={connCardClass(disabled ? "muted" : linked ? "neutral" : "warn")}>
      {linked && picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picture} alt="" className="w-12 h-12 rounded-xl flex-none" style={{ objectFit: "cover", background: "var(--w-bg-alternative)" }} />
      ) : (
        <div className="w-12 h-12 rounded-xl grid place-items-center flex-none bg-[rgba(101,65,242,0.14)] text-[var(--w-accent-violet)] dark:bg-[rgba(101,65,242,0.22)] dark:text-[#b9a4ff]"><Icon name="image" size={20} /></div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-4">
          <div style={{ minWidth: 0 }}>
            <div className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]" style={{ color: "var(--w-fg-alternative)", marginBottom: 6 }}>
              Instagram 비즈니스 계정
            </div>
            <div className="font-bold text-[16.5px] leading-[1.35] [font-family:var(--w-font-display)] tracking-[-0.012em]" style={{ color: disabled ? "var(--w-fg-neutral)" : "var(--w-fg-strong)" }}>{linked ? `@${username}` : "연결되지 않음"}</div>
            <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)]" style={{ marginTop: 6 }}>
              {linked
                ? "선택한 페이스북 페이지에 연결된 Instagram 계정의 인사이트를 보여드려요."
                : "선택한 페이스북 페이지에 Instagram 비즈니스 계정이 연결돼 있지 않아요. 페이지 설정에서 Instagram 계정을 연결한 뒤 아래 [다시 불러오기]를 눌러주세요."}
            </div>
            {linked && !disabled && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 mb-1.5">
                {insightsAuthorized
                  ? <PermCheck label="인사이트 권한" />
                  : <a className="inline-flex items-center gap-[5px] font-semibold text-[12.5px] leading-none text-[var(--w-primary-normal)] hover:underline" href="/api/instagram/connect"><Icon name="chart" size={13} /> 인사이트 권한 받기</a>}
                {publishAuthorized
                  ? <PermCheck label="게시 권한" />
                  : <span className="inline-flex items-center gap-[5px] font-semibold text-[12.5px] leading-none text-[var(--w-status-cautionary)]"><Icon name="warn" size={12} /> 게시 권한 없음</span>}
              </div>
            )}
            {id && (
              <IdField
                label="Instagram 비즈니스 ID"
                id={id}
                desc="Instagram 인사이트가 사용하는 비즈니스 계정 식별자."
              />
            )}
          </div>
          <div className="flex flex-col gap-2.5 items-end flex-none">
            {linked
              ? <span className="inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full font-semibold text-[11.5px] leading-none text-[var(--w-status-positive)] bg-[rgba(0,191,64,0.10)] dark:bg-[rgba(73,229,125,0.14)] dark:text-[#49e57d]"><span className="w-1.5 h-1.5 rounded-full bg-[var(--w-status-positive)] dark:bg-[#49e57d]" /> 연결됨</span>
              : <span className="inline-flex items-center gap-[5px] px-2.5 py-1 rounded-full font-semibold text-[12px] leading-none text-[var(--w-status-cautionary)] bg-[rgba(255,146,0,0.12)]"><Icon name="warn" size={12} /> 미연결</span>}
            {linked && !disabled && (
              <a className={buttonVariants({ variant: "ghost", size: "sm" })} href="/api/instagram/connect">
                <Icon name="refresh" size={13} /> 재연결
              </a>
            )}
            {!linked && !disabled && (
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <a
                  className={buttonVariants({ variant: "primary", size: "sm" })}
                  href={linkInstagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="link" size={13} /> Instagram 연결하기
                </a>
                <Button variant="ghost" size="sm" type="button" onClick={onReload}>
                  <Icon name="refresh" size={13} /> 다시 불러오기
                </Button>
              </div>
            )}
          </div>
        </div>
        {disabled && (
          <div className={cn("flex items-center gap-2.5 p-[10px_12px] rounded-[10px] font-medium text-[12.5px] leading-[1.5] mt-3.5", "bg-[var(--w-bg-alternative)] text-[var(--w-fg-alternative)] border border-[var(--w-line-alternative)]")}>
            <Icon name="lock" size={13} />
            <span>재인증 후 확인할 수 있어요.</span>
          </div>
        )}
        {linked && !publishAuthorized && !disabled && (
          <div className={cn("flex items-center gap-2.5 p-[10px_12px] rounded-[10px] font-medium text-[12.5px] leading-[1.5] mt-3.5", "bg-[rgba(255,146,0,0.10)] border border-[rgba(255,146,0,0.24)] text-[var(--w-status-cautionary)]")}>
            <Icon name="warn" size={14} />
            <span style={{ flex: 1 }}>게시 권한 토큰이 없어요. <strong>재연결</strong> 후에도 해결 안 되면 <strong>수동 토큰 적용</strong>을 눌러보세요.</span>
            <Button variant="ghost" size="sm" type="button" onClick={onApplyToken} disabled={applyingToken}>
              <Icon name="refresh" size={13} /> {applyingToken ? "적용 중…" : "수동 토큰 적용"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

const PERMS: { code: string; label: string }[] = [
  { code: "ads_management", label: "광고 생성·게재·일시정지·예산 제어를 할 수 있어요" },
  { code: "ads_read", label: "노출·클릭·CTR·지출 등 성과 데이터를 조회해요" },
  { code: "pages_show_list", label: "연결할 페이스북 페이지 목록을 가져와요" },
  { code: "instagram_basic", label: "연결된 Instagram 비즈니스 계정의 기본 프로필을 읽어요" },
  { code: "instagram_manage_insights", label: "Instagram 게시물·계정의 인사이트를 조회해요" },
];

function PermissionsDisclosure({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <button className="w-full flex items-center justify-between p-[18px_22px] bg-transparent border-none cursor-pointer text-left hover:bg-[var(--w-bg-alternative)] transition-colors duration-[120ms]" type="button" onClick={onToggle} aria-expanded={open}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="w-8 h-8 rounded-[9px] bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)] grid place-items-center flex-none"><Icon name="lock" size={14} /></span>
          <div style={{ textAlign: "left" }}>
            <div className="font-semibold text-[14px] leading-[1.3] text-[var(--w-fg-strong)]">AdFlow가 쓰는 권한</div>
            <div className="font-medium text-[12px] leading-[1.4] text-[var(--w-fg-neutral)]" style={{ marginTop: 3 }}>Facebook 비밀번호는 받지도 저장하지도 않아요.</div>
          </div>
        </div>
        <Icon name="chev-down" size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms ease", color: "var(--w-fg-neutral)" }} />
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 px-[22px] pb-5 pt-4 border-t border-[var(--w-line-alternative)]">
          {PERMS.map((p) => (
            <div key={p.code} className="flex items-start gap-3.5 p-[10px_12px] bg-[var(--w-bg-alternative)] rounded-[10px]">
              <span className="font-semibold text-[11.5px] leading-[1.3] [font-family:var(--w-font-mono)] text-[var(--w-primary-press)] bg-[var(--w-bg-elevated)] px-[9px] py-[5px] rounded-[6px] flex-none border border-[var(--w-line-alternative)]">{p.code}</span>
              <span className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-strong)] pt-1">{p.label}</span>
            </div>
          ))}
          <div className="flex items-start gap-2 p-1 font-medium text-[12px] leading-[1.55] text-[var(--w-fg-alternative)]">
            <Icon name="info" size={12} />
            <span>AdFlow는 이 권한으로 위 작업만 합니다. 동의는 언제든 Facebook 설정에서 철회할 수 있어요.</span>
          </div>
        </div>
      )}
    </Card>
  );
}

function UnconnectedCTA({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="relative overflow-hidden bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-[18px] p-[48px_48px_40px] text-center before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-[220px] before:bg-[radial-gradient(circle_at_50%_0%,rgba(0,102,255,0.08),transparent_60%)] dark:before:bg-[radial-gradient(circle_at_50%_0%,rgba(0,102,255,0.18),transparent_60%)] before:pointer-events-none">
      <div className="relative inline-flex items-center justify-center gap-3.5 mb-[22px] z-[1]">
        <div className="w-16 h-16 rounded-[18px] grid place-items-center shadow-[0_6px_16px_rgba(0,0,0,0.08)] bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] font-extrabold text-[30px] leading-none [font-family:var(--w-font-display)]">A</div>
        <div className="w-7 h-7 rounded-lg bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] text-[var(--w-fg-neutral)] grid place-items-center"><Icon name="link" size={18} /></div>
        <div className="w-16 h-16 rounded-[18px] grid place-items-center shadow-[0_6px_16px_rgba(0,0,0,0.08)] bg-[#1877F2] text-white"><Icon name="facebook" size={32} /></div>
      </div>
      <h2 className="font-extrabold text-[26px] leading-[1.25] [font-family:var(--w-font-display)] text-[var(--w-fg-strong)] tracking-[-0.022em] m-0 mb-2.5 relative z-[1]">AdFlow를 Meta 광고 계정에 연결하세요</h2>
      <p className="font-medium text-[14.5px] leading-[1.6] text-[var(--w-fg-neutral)] max-w-[480px] mx-auto mb-[30px] relative z-[1]">연결하면 AdFlow가 광고를 자동으로 게재하고, 성과를 추적하고, 최적화 제안을 만들어줘요.</p>
      <div className="grid grid-cols-3 gap-3.5 max-w-[680px] mx-auto mb-7 relative z-[1]">
        <CtaFeature icon="megaphone" title="광고 게재" desc="이 자리에서 바로 광고를 만들고 Meta에 올려요." />
        <CtaFeature icon="chart" title="성과 추적" desc="노출·클릭·CTR을 자동으로 가져와 보여줘요." />
        <CtaFeature icon="sparkles" title="최적화 제안" desc="실적이 낮은 소재·타겟에 대한 개선안을 받아요." />
      </div>
      <div className="flex flex-col w-max max-w-full text-left p-[20px_28px] bg-[var(--w-bg-alternative)] rounded-[14px] mx-auto mb-7 relative z-[1]">
        <div className="font-semibold text-[11.5px] leading-none [font-family:var(--w-font-sans)] text-[var(--w-fg-alternative)] tracking-[0.06em] uppercase mb-3.5">필요한 것</div>
        <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
          <li className="flex items-center gap-2.5 font-medium text-[14px] leading-[1.45] text-[var(--w-fg-strong)] [&_svg]:text-[var(--w-fg-neutral)]"><Icon name="wallet" size={15} /> Meta Business 광고 계정 1개</li>
          <li className="flex items-center gap-2.5 font-medium text-[14px] leading-[1.45] text-[var(--w-fg-strong)] [&_svg]:text-[var(--w-fg-neutral)]"><Icon name="doc" size={15} /> 관리 중인 페이스북 페이지 1개</li>
        </ul>
      </div>
      <Button variant="fb" type="button" onClick={onConnect}><Icon name="facebook" size={16} /> 광고 계정·페이지 연결하기</Button>
      <div className="font-medium text-[11.5px] leading-[1.5] text-[var(--w-fg-alternative)] mt-3.5 relative z-[1]">이미 Facebook으로 로그인돼 있어요. 광고 계정과 페이지를 골라주세요.</div>
    </div>
  );
}

function CtaFeature({ icon, title, desc }: { icon: IconName; title: string; desc: string }) {
  return (
    <div className="p-[18px] bg-[var(--w-bg-alternative)] rounded-xl text-left">
      <div className="w-8 h-8 rounded-[9px] bg-[var(--w-bg-elevated)] text-[var(--w-primary-press)] grid place-items-center mb-2.5 border border-[var(--w-line-alternative)]"><Icon name={icon} size={18} /></div>
      <div className="font-bold text-[13.5px] leading-[1.3] text-[var(--w-fg-strong)]">{title}</div>
      <div className="font-medium text-[12px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1">{desc}</div>
    </div>
  );
}

function PickerModal({ kind, title, subtitle, currentId, onClose, onPick }: {
  kind: PickerKind; title: string; subtitle: string; currentId?: string; onClose: () => void; onPick: (it: PickerItem) => void | Promise<void>;
}) {
  const q = useQuery({ queryKey: ["picker-list", kind], queryFn: () => fetchPickerList(kind) });
  const [picking, setPicking] = useState<string | null>(null);
  const items = q.data ?? [];

  const handlePick = async (it: PickerItem) => {
    setPicking(it.id);
    try { await onPick(it); } finally { setPicking(null); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[rgba(15,17,21,0.45)] dark:bg-[rgba(0,0,0,0.6)] grid place-items-center p-10 animate-[fadeIn_120ms_ease]" onClick={onClose}>
      <div className="bg-[var(--w-bg-elevated)] border border-[var(--w-line-alternative)] rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.20)] max-w-[90vw] max-h-[90vh] overflow-auto animate-[popIn_140ms_ease]" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 pb-0">
          <div>
            <h3 className="font-bold text-[17px] leading-[1.3] [font-family:var(--w-font-display)] text-[var(--w-fg-strong)] tracking-[-0.01em] m-0">{title}</h3>
            <div className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)]" style={{ marginTop: 4 }}>{subtitle}</div>
          </div>
          <button className="w-8 h-8 rounded-lg border border-transparent bg-transparent text-[var(--w-fg-neutral)] cursor-pointer inline-grid place-items-center hover:bg-[var(--w-bg-neutral)] hover:text-[var(--w-fg-strong)] transition-[background,color] duration-[120ms]" type="button" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div style={{ padding: "16px 20px 4px" }}>
          {q.isLoading ? (
            <div className="flex flex-col gap-1 max-h-[380px] overflow-y-auto py-1 pb-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-transparent border border-transparent rounded-[10px] w-full" style={{ pointerEvents: "none" }}>
                  <Skeleton className="w-8 h-8 rounded-lg flex-none" />
                  <div style={{ flex: 1 }}>
                    <Skeleton className="h-[13px] w-40 mb-1.5" />
                    <Skeleton className="h-[11px] w-[110px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : q.isError ? (
            <div style={{ padding: "28px 18px 18px", textAlign: "center" }}>
              <div className="font-semibold text-[13.5px] leading-[1.4] text-[var(--w-fg-strong)]">목록을 불러오지 못했어요</div>
              <p className="font-medium text-[12.5px] leading-[1.5] text-[var(--w-fg-neutral)]" style={{ margin: "8px 0 14px" }}>{q.error instanceof Error ? q.error.message : "잠시 후 다시 시도해 주세요."}</p>
              <Button variant="secondary" size="sm" type="button" onClick={() => q.refetch()}>다시 시도</Button>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: "32px 18px 20px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, margin: "0 auto 12px", background: "var(--w-bg-alternative)", color: "var(--w-fg-neutral)", display: "grid", placeItems: "center" }}>
                <Icon name={kind === "account" ? "wallet" : kind === "pixel" ? "chart" : "doc"} size={22} />
              </div>
              <div className="font-bold text-[14.5px] leading-[1.35] [font-family:var(--w-font-display)] text-[var(--w-fg-strong)]">{kind === "pixel" ? "이 광고 계정에 Pixel이 없어요" : kind === "account" ? "연결된 광고 계정이 없어요" : "관리 중인 페이스북 페이지가 없어요"}</div>
              <p className="font-medium text-[12.5px] leading-[1.55] text-[var(--w-fg-neutral)]" style={{ maxWidth: 320, margin: "10px auto 0" }}>
                {kind === "pixel" ? "Meta Events Manager에서 Pixel을 먼저 만들어주세요." : kind === "account" ? "Meta Business Manager에서 광고 계정을 먼저 만들어주세요." : "페이지 권한이 없거나 페이지가 없어요. 다른 계정으로 다시 로그인하면 권한을 다시 요청해요."}
              </p>
              <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
                {kind === "page" && <Button variant="ghost" size="sm" type="button" onClick={() => signOut({ callbackUrl: "/login" })}><Icon name="refresh" size={13} /> 다른 계정으로 다시 로그인</Button>}
                <Button variant="ghost" size="sm" type="button" onClick={() => q.refetch()}>목록 새로고침</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1 max-h-[380px] overflow-y-auto py-1 pb-3">
              {items.map((it) => {
                const current = it.id === currentId;
                return (
                  <button
                    key={it.id}
                    className={cn(
                      "flex items-center gap-3 p-3 bg-transparent border border-transparent rounded-[10px] cursor-pointer text-left w-full hover:bg-[var(--w-bg-alternative)] hover:border-[var(--w-line-alternative)] transition-[background,border-color] duration-[120ms]",
                      current && "bg-[var(--w-primary-soft)] border-[rgba(0,102,255,0.18)] dark:bg-[rgba(0,102,255,0.14)] hover:bg-[var(--w-primary-soft)]"
                    )}
                    type="button"
                    disabled={!!picking}
                    onClick={() => handlePick(it)}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-[9px] grid place-items-center flex-none",
                      kind === "account" && "bg-[var(--w-primary-soft)] text-[var(--w-primary-press)] dark:bg-[rgba(0,102,255,0.18)] dark:text-[#6ea7ff]",
                      kind === "page" && "bg-[rgba(101,65,242,0.14)] text-[var(--w-accent-violet)] dark:bg-[rgba(101,65,242,0.22)] dark:text-[#b9a4ff]",
                      kind === "pixel" && "bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)]"
                    )}><Icon name={kind === "account" ? "wallet" : kind === "pixel" ? "chart" : "doc"} size={16} /></div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div className="flex items-center gap-2 font-semibold text-[13.5px] leading-[1.3] text-[var(--w-fg-strong)]">
                        {it.name}
                        {it.status === "disabled" && <span className="font-semibold text-[10px] leading-none [font-family:var(--w-font-mono)] bg-[rgba(255,146,0,0.12)] text-[var(--w-status-cautionary)] px-1.5 py-[3px] rounded-[4px] tracking-[0.04em]">비활성</span>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap font-medium text-[11.5px] leading-[1.3] [font-family:var(--w-font-mono)] text-[var(--w-fg-neutral)] mt-1">
                        <span>{maskId(it.id)}</span>
                        {it.currency && <><span className="w-[3px] h-[3px] rounded-full bg-[var(--w-fg-alternative)]" /><span>{it.currency}</span></>}
                      </div>
                    </div>
                    {picking === it.id
                      ? <div className="rounded-full border-2 border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite]" style={{ width: 16, height: 16 }} />
                      : current
                        ? <span className="w-[22px] h-[22px] rounded-full bg-[var(--w-primary-normal)] text-white grid place-items-center flex-none"><Icon name="check" size={13} strokeWidth={3} /></span>
                        : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-6 py-[18px] border-t border-[var(--w-line-alternative)] mt-5">
          <Button variant="ghost" type="button" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </div>
  );
}

function ConnectSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {[0, 1, 2].map((i) => (
        <Card key={i} style={{ padding: 20, display: "flex", gap: 16, alignItems: "flex-start" }}>
          <Skeleton className="w-[52px] h-[52px] rounded-[14px] flex-none" />
          <div style={{ flex: 1 }}>
            <Skeleton className="h-[11px] w-[60px] mb-2.5" />
            <Skeleton className="h-[16px] w-[220px] mb-2.5" />
            <Skeleton className="h-[12px] w-[180px]" />
          </div>
          <Skeleton className="h-[30px] w-[110px] rounded-lg flex-none" />
        </Card>
      ))}
    </div>
  );
}

function ErrorCard({ title, reason, onRetry }: { title: string; reason: string; onRetry: () => void }) {
  return (
    <Card style={{ padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,66,66,0.10)", color: "var(--w-status-negative)", display: "grid", placeItems: "center" }}><Icon name="warn" size={24} /></div>
      <div className="font-bold text-[17px] leading-[1.3] text-[var(--w-fg-strong)]" style={{ letterSpacing: "-0.01em" }}>{title}</div>
      <div className="font-medium text-[13px] leading-[1.5] text-[var(--w-fg-neutral)]" style={{ maxWidth: 380 }}>{reason}</div>
      <Button variant="secondary" type="button" style={{ marginTop: 8 }} onClick={onRetry}>다시 시도</Button>
    </Card>
  );
}
