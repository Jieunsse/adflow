"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Icon, { type IconName } from "@shared/ui/Icon";
import { useToast } from "@shared/ui/Toast";
import ConfirmModal from "@shared/ui/ConfirmModal";
import IdField from "@shared/ui/IdField";
import { maskId } from "@shared/lib/format";

type AccountInfo = { connected: boolean; accountId: string; accountName: string; currency: string };

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

export default function ConnectPage() {
  const router = useRouter();
  const showToast = useToast();
  const { data: session, update } = useSession();
  const queryClient = useQueryClient();
  const [permsOpen, setPermsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<PickerKind | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [reauthing, setReauthing] = useState(false);

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
    <div className="page" data-screen-label="계정 연결">
      <div className="page__head">
        <div>
          <span className="w-overline" style={{ color: "var(--w-fg-neutral)" }}>워크스페이스 · 계정 연결</span>
          <h1 className="page__title" style={{ marginTop: 4 }}>Meta 광고 계정 연결</h1>
          <p className="page__sub">AdFlow가 어떤 Meta 광고 계정·페이스북 페이지에 연결돼 있는지 보고, 바꾸고, 끊을 수 있어요.</p>
        </div>
      </div>

      {isExploring && (
        <div className="explore-banner">
          <div className="explore-banner__icon"><Icon name="info" size={16} /></div>
          <div style={{ flex: 1 }}>
            <div className="explore-banner__title">둘러보기 중</div>
            <div className="explore-banner__sub">계정을 연결하면 실제 광고 집행과 성과 추적이 가능해요.</div>
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
            disabled={tokenExpired}
            onReload={() => {
              queryClient.invalidateQueries({ queryKey: ["picker-list", "page"] });
              setPickerOpen("page");
            }}
          />
          <PixelCard name={pixelName} id={pixelId} disabled={tokenExpired} onChange={() => setPickerOpen("pixel")} />

          <PermissionsDisclosure open={permsOpen} onToggle={() => setPermsOpen((o) => !o)} />

          <div className="danger-zone">
            <div style={{ flex: 1 }}>
              <div className="danger-zone__title">Meta 연결 해제</div>
              <div className="danger-zone__sub">해제하면 캠페인 성과 조회·게재 제어가 멈춰요. 다시 연결하려면 로그아웃 후 Facebook으로 다시 로그인하면 돼요.</div>
            </div>
            <button className="btn btn--danger" type="button" onClick={() => setConfirmDisconnect(true)}>
              <Icon name="link" size={14} /> 연결 해제
            </button>
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
    <div className={"conn-card conn-card--" + (tokenExpired ? "danger" : "neutral")}>
      <div className="conn-card__icon conn-card__icon--fb"><Icon name="facebook" size={26} /></div>
      <div className="conn-card__body">
        <div className="conn-card__row">
          <div>
            <div className="conn-card__title">{tokenExpired ? "Meta 인증이 만료됐어요" : "Facebook에 연결됨"}</div>
            <div className="conn-card__meta">
              {memberImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={memberImage} alt="" className="conn-card__avatar" style={{ objectFit: "cover" }} />
              ) : (
                <span className="conn-card__avatar" style={{ background: "#0066ff" }}>{(memberName.trim()[0] ?? "?").toUpperCase()}</span>
              )}
              <span>{memberName ? `${memberName}님이 연결` : "Facebook 계정으로 연결됨"}</span>
              <span className="conn-card__dot" />
              <span className="conn-card__meta-mono">장기 액세스 토큰 (약 60일)</span>
            </div>
          </div>
          <div className="conn-card__right">
            {tokenExpired
              ? <span className="status-badge-danger"><Icon name="warn" size={12} /> 인증 만료</span>
              : <span className="status-badge status-badge--active"><span className="status-dot" /> 정상</span>}
          </div>
        </div>
        {tokenExpired && (
          <div className="alert-bar alert-bar--danger">
            <Icon name="warn" size={14} />
            <span style={{ flex: 1 }}><strong>Meta 인증이 만료됐어요.</strong> 재인증해야 광고 집행과 성과 조회를 다시 할 수 있어요.</span>
            <button className="btn btn--danger btn--sm" type="button" onClick={onReauth} disabled={reauthing}><Icon name="refresh" size={13} /> {reauthing ? "이동 중…" : "재인증"}</button>
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
    <div className={"conn-card conn-card--" + tone}>
      <div className="conn-card__icon conn-card__icon--account"><Icon name="wallet" size={22} /></div>
      <div className="conn-card__body">
        <div className="conn-card__row">
          <div style={{ minWidth: 0 }}>
            <div className="w-overline" style={{ color: "var(--w-fg-alternative)", marginBottom: 6 }}>광고 계정</div>
            <div className="conn-card__title">{name}</div>
            {currency !== "—" && (
              <div className="conn-card__id-row">
                <span className="conn-card__id">{currency}</span>
              </div>
            )}
            <IdField
              label="광고 계정 ID"
              id={id}
              desc="Meta 광고 계정의 고유 번호. 결제·문의 시 Meta에 알려주는 값이에요."
            />
          </div>
          <div className="conn-card__right">
            {status === "disabled"
              ? <span className="status-badge-warn"><Icon name="warn" size={12} /> 비활성·정지</span>
              : status === "active"
                ? <span className="status-badge status-badge--active"><span className="status-dot" /> 활성</span>
                : null}
          </div>
        </div>
        {status === "disabled" && (
          <div className="alert-bar alert-bar--warn">
            <Icon name="warn" size={14} />
            <span>이 광고 계정이 <strong>비활성/정지</strong> 상태예요. Meta 광고 관리자에서 결제·정책 위반 등을 확인해 주세요.</span>
          </div>
        )}
        {disabled && (
          <div className="alert-bar alert-bar--muted">
            <Icon name="lock" size={13} />
            <span>재인증 후 확인할 수 있어요.</span>
          </div>
        )}
        {!disabled && (
          <div className="conn-card__foot">
            <button className="btn btn--secondary btn--sm" type="button" onClick={onChange}>광고 계정 변경</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PixelCard({ name, id, disabled, onChange }: { name: string | null; id: string | null; disabled: boolean; onChange: () => void }) {
  return (
    <div className={"conn-card conn-card--" + (disabled ? "muted" : "neutral")}>
      <div className="conn-card__icon conn-card__icon--page"><Icon name="chart" size={20} /></div>
      <div className="conn-card__body">
        <div className="conn-card__row">
          <div style={{ minWidth: 0 }}>
            <div className="w-overline" style={{ color: "var(--w-fg-alternative)", marginBottom: 6 }}>
              Facebook Pixel <span style={{ font: "500 11px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)", verticalAlign: "middle" }}>(선택)</span>
            </div>
            <div className="conn-card__title">{name ?? "선택 안 됨"}</div>
            <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 6 }}>
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
          <div className="alert-bar alert-bar--muted">
            <Icon name="lock" size={13} />
            <span>재인증 후 확인할 수 있어요.</span>
          </div>
        )}
        {!disabled && (
          <div className="conn-card__foot">
            <button className="btn btn--secondary btn--sm" type="button" onClick={onChange}>{name ? "Pixel 변경" : "Pixel 선택"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PageCard({ name, id, picture, disabled, onChange }: { name: string; id: string; picture: string | null; disabled: boolean; onChange: () => void }) {
  return (
    <div className={"conn-card conn-card--" + (disabled ? "muted" : "neutral")}>
      {picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picture} alt="" className="conn-card__icon" style={{ objectFit: "cover", background: "var(--w-bg-alternative)" }} />
      ) : (
        <div className="conn-card__icon conn-card__icon--page"><Icon name="doc" size={20} /></div>
      )}
      <div className="conn-card__body">
        <div className="conn-card__row">
          <div style={{ minWidth: 0 }}>
            <div className="w-overline" style={{ color: "var(--w-fg-alternative)", marginBottom: 6 }}>페이스북 페이지</div>
            <div className="conn-card__title">{name}</div>
            <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 6 }}>광고가 이 페이지 명의로 게재돼요.</div>
            <IdField
              label="페이지 ID"
              id={id}
              desc="광고가 게재되는 페이스북 페이지의 고유 번호."
            />
          </div>
        </div>
        {disabled && (
          <div className="alert-bar alert-bar--muted">
            <Icon name="lock" size={13} />
            <span>재인증 후 확인할 수 있어요.</span>
          </div>
        )}
        {!disabled && (
          <div className="conn-card__foot">
            <button className="btn btn--secondary btn--sm" type="button" onClick={onChange}>페이지 변경</button>
          </div>
        )}
      </div>
    </div>
  );
}

function InstagramCard({ username, id, picture, pageId, disabled, onReload }: {
  username: string | null; id: string | null; picture: string | null; pageId: string | null; disabled: boolean; onReload: () => void;
}) {
  const linked = !!id;
  const linkInstagramUrl = pageId
    ? `https://www.facebook.com/${pageId}/settings/?tab=linked_accounts`
    : "https://accountscenter.facebook.com/connected_experiences";
  return (
    <div className={"conn-card conn-card--" + (disabled ? "muted" : linked ? "neutral" : "warn")}>
      {linked && picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picture} alt="" className="conn-card__icon" style={{ objectFit: "cover", background: "var(--w-bg-alternative)" }} />
      ) : (
        <div className="conn-card__icon conn-card__icon--page"><Icon name="image" size={20} /></div>
      )}
      <div className="conn-card__body">
        <div className="conn-card__row">
          <div style={{ minWidth: 0 }}>
            <div className="w-overline" style={{ color: "var(--w-fg-alternative)", marginBottom: 6 }}>
              Instagram 비즈니스 계정
            </div>
            <div className="conn-card__title">{linked ? `@${username}` : "연결되지 않음"}</div>
            <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 6 }}>
              {linked
                ? "선택한 페이스북 페이지에 연결된 Instagram 계정의 인사이트를 보여드려요."
                : "선택한 페이스북 페이지에 Instagram 비즈니스 계정이 연결돼 있지 않아요. 페이지 설정에서 Instagram 계정을 연결한 뒤 아래 [다시 불러오기]를 눌러주세요."}
            </div>
            {id && (
              <IdField
                label="Instagram 비즈니스 ID"
                id={id}
                desc="Instagram 인사이트가 사용하는 비즈니스 계정 식별자."
              />
            )}
          </div>
          <div className="conn-card__right">
            {linked
              ? <span className="status-badge status-badge--active"><span className="status-dot" /> 연결됨</span>
              : <span className="status-badge-warn"><Icon name="warn" size={12} /> 미연결</span>}
            {!linked && !disabled && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <a
                  className="btn btn--primary btn--sm"
                  href={linkInstagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="link" size={13} /> Instagram 연결하기
                </a>
                <button className="btn btn--ghost btn--sm" type="button" onClick={onReload}>
                  <Icon name="refresh" size={13} /> 다시 불러오기
                </button>
              </div>
            )}
          </div>
        </div>
        {disabled && (
          <div className="alert-bar alert-bar--muted">
            <Icon name="lock" size={13} />
            <span>재인증 후 확인할 수 있어요.</span>
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
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <button className="disclosure__head" type="button" onClick={onToggle} aria-expanded={open}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="disclosure__icon"><Icon name="lock" size={14} /></span>
          <div style={{ textAlign: "left" }}>
            <div style={{ font: "600 14px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>AdFlow가 쓰는 권한</div>
            <div style={{ font: "500 12px/1.4 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 3 }}>Facebook 비밀번호는 받지도 저장하지도 않아요.</div>
          </div>
        </div>
        <Icon name="chev-down" size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms ease", color: "var(--w-fg-neutral)" }} />
      </button>
      {open && (
        <div className="disclosure__body">
          {PERMS.map((p) => (
            <div key={p.code} className="perm-item">
              <span className="perm-item__code">{p.code}</span>
              <span className="perm-item__label">{p.label}</span>
            </div>
          ))}
          <div className="perm-item__note">
            <Icon name="info" size={12} />
            <span>AdFlow는 이 권한으로 위 작업만 합니다. 동의는 언제든 Facebook 설정에서 철회할 수 있어요.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function UnconnectedCTA({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="connect-cta">
      <div className="connect-cta__glyph">
        <div className="connect-cta__glyph-a">A</div>
        <div className="connect-cta__glyph-link"><Icon name="link" size={18} /></div>
        <div className="connect-cta__glyph-fb"><Icon name="facebook" size={32} /></div>
      </div>
      <h2 className="connect-cta__title">AdFlow를 Meta 광고 계정에 연결하세요</h2>
      <p className="connect-cta__sub">연결하면 AdFlow가 광고를 자동으로 게재하고, 성과를 추적하고, 최적화 제안을 만들어줘요.</p>
      <div className="connect-cta__features">
        <CtaFeature icon="megaphone" title="광고 게재" desc="이 자리에서 바로 광고를 만들고 Meta에 올려요." />
        <CtaFeature icon="chart" title="성과 추적" desc="노출·클릭·CTR을 자동으로 가져와 보여줘요." />
        <CtaFeature icon="sparkles" title="최적화 제안" desc="실적이 낮은 소재·타겟에 대한 개선안을 받아요." />
      </div>
      <div className="connect-cta__require">
        <div className="connect-cta__require-title">필요한 것</div>
        <ul className="connect-cta__require-list">
          <li><Icon name="wallet" size={15} /> Meta Business 광고 계정 1개</li>
          <li><Icon name="doc" size={15} /> 관리 중인 페이스북 페이지 1개</li>
        </ul>
      </div>
      <button className="btn btn--fb" type="button" onClick={onConnect}><Icon name="facebook" size={16} /> 광고 계정·페이지 연결하기</button>
      <div className="connect-cta__legal">이미 Facebook으로 로그인돼 있어요. 광고 계정과 페이지를 골라주세요.</div>
    </div>
  );
}

function CtaFeature({ icon, title, desc }: { icon: IconName; title: string; desc: string }) {
  return (
    <div className="cta-feat">
      <div className="cta-feat__icon"><Icon name={icon} size={18} /></div>
      <div className="cta-feat__title">{title}</div>
      <div className="cta-feat__desc">{desc}</div>
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3 className="modal__title">{title}</h3>
            <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>{subtitle}</div>
          </div>
          <button className="icon-btn" type="button" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <div style={{ padding: "16px 20px 4px" }}>
          {q.isLoading ? (
            <div className="picker-list">
              {[0, 1, 2].map((i) => (
                <div key={i} className="picker-row" style={{ pointerEvents: "none" }}>
                  <div className="skel" style={{ width: 32, height: 32, borderRadius: 8 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skel" style={{ height: 13, width: 160, marginBottom: 6 }} />
                    <div className="skel" style={{ height: 11, width: 110 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : q.isError ? (
            <div style={{ padding: "28px 18px 18px", textAlign: "center" }}>
              <div style={{ font: "600 13.5px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>목록을 불러오지 못했어요</div>
              <p style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "8px 0 14px" }}>{q.error instanceof Error ? q.error.message : "잠시 후 다시 시도해 주세요."}</p>
              <button className="btn btn--secondary btn--sm" type="button" onClick={() => q.refetch()}>다시 시도</button>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: "32px 18px 20px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, margin: "0 auto 12px", background: "var(--w-bg-alternative)", color: "var(--w-fg-neutral)", display: "grid", placeItems: "center" }}>
                <Icon name={kind === "account" ? "wallet" : kind === "pixel" ? "chart" : "doc"} size={22} />
              </div>
              <div style={{ font: "700 14.5px/1.35 var(--w-font-display)", color: "var(--w-fg-strong)" }}>{kind === "pixel" ? "이 광고 계정에 Pixel이 없어요" : kind === "account" ? "연결된 광고 계정이 없어요" : "관리 중인 페이스북 페이지가 없어요"}</div>
              <p style={{ font: "500 12.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-neutral)", maxWidth: 320, margin: "10px auto 0" }}>
                {kind === "pixel" ? "Meta Events Manager에서 Pixel을 먼저 만들어주세요." : kind === "account" ? "Meta Business Manager에서 광고 계정을 먼저 만들어주세요." : "페이지 권한이 없거나 페이지가 없어요. 다른 계정으로 다시 로그인하면 권한을 다시 요청해요."}
              </p>
              <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
                {kind === "page" && <button className="btn btn--ghost btn--sm" type="button" onClick={() => signOut({ callbackUrl: "/login" })}><Icon name="refresh" size={13} /> 다른 계정으로 다시 로그인</button>}
                <button className="btn btn--ghost btn--sm" type="button" onClick={() => q.refetch()}>목록 새로고침</button>
              </div>
            </div>
          ) : (
            <div className="picker-list">
              {items.map((it) => {
                const current = it.id === currentId;
                return (
                  <button key={it.id} className={"picker-row" + (current ? " picker-row--current" : "")} type="button" disabled={!!picking} onClick={() => handlePick(it)}>
                    <div className={"picker-row__icon picker-row__icon--" + kind}><Icon name={kind === "account" ? "wallet" : kind === "pixel" ? "chart" : "doc"} size={16} /></div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div className="picker-row__title">
                        {it.name}
                        {it.status === "disabled" && <span className="picker-row__sub-badge">비활성</span>}
                      </div>
                      <div className="picker-row__id">
                        <span>{maskId(it.id)}</span>
                        {it.currency && <><span className="conn-card__dot" /><span>{it.currency}</span></>}
                      </div>
                    </div>
                    {picking === it.id ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : current ? <span className="picker-row__check"><Icon name="check" size={13} strokeWidth={3} /></span> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" type="button" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function ConnectSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card" style={{ padding: 20, display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div className="skel" style={{ width: 52, height: 52, borderRadius: 14 }} />
          <div style={{ flex: 1 }}>
            <div className="skel" style={{ height: 11, width: 60, marginBottom: 10 }} />
            <div className="skel" style={{ height: 16, width: 220, marginBottom: 10 }} />
            <div className="skel" style={{ height: 12, width: 180 }} />
          </div>
          <div className="skel" style={{ height: 30, width: 110, borderRadius: 8 }} />
        </div>
      ))}
    </div>
  );
}

function ErrorCard({ title, reason, onRetry }: { title: string; reason: string; onRetry: () => void }) {
  return (
    <div className="card" style={{ padding: "40px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,66,66,0.10)", color: "var(--w-status-negative)", display: "grid", placeItems: "center" }}><Icon name="warn" size={24} /></div>
      <div style={{ font: "700 17px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", letterSpacing: "-0.01em" }}>{title}</div>
      <div style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", maxWidth: 380 }}>{reason}</div>
      <button className="btn btn--secondary" type="button" style={{ marginTop: 8 }} onClick={onRetry}>다시 시도</button>
    </div>
  );
}
