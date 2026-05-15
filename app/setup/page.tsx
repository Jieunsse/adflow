"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Icon from "@shared/ui/Icon";

interface AdAccount {
  id: string;
  name: string;
  currency: string;
  account_status: number;
}

interface FbPage {
  id: string;
  name: string;
  igUserId: string | null;
  igUsername: string | null;
}

type Phase = "account" | "page";

function PickRow({
  kind,
  title,
  meta,
  badge,
  busy,
  dimmed,
  disabled,
  onClick,
}: {
  kind: "account" | "page";
  title: string;
  meta: string[];
  badge?: string;
  busy: boolean;
  dimmed: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="picker-row"
      onClick={onClick}
      disabled={disabled}
      style={{ opacity: dimmed ? 0.45 : 1, cursor: disabled ? "default" : "pointer" }}
    >
      <div className={"picker-row__icon picker-row__icon--" + kind}>
        <Icon name={kind === "account" ? "wallet" : "doc"} size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div className="picker-row__title">
          {title}
          {badge && <span className="picker-row__sub-badge">{badge}</span>}
        </div>
        <div className="picker-row__id">
          {meta.map((m, i) => (
            <span key={m} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <span className="conn-card__dot" />}
              <span>{m}</span>
            </span>
          ))}
        </div>
      </div>
      {busy ? (
        <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
      ) : (
        <Icon name="arrow-right" size={14} style={{ color: "var(--w-fg-alternative)", flex: "0 0 auto" }} />
      )}
    </button>
  );
}

function SetupEmpty({ kind }: { kind: "account" | "page" }) {
  return (
    <div className="setup-empty">
      <div className="setup-empty__icon">
        <Icon name={kind === "account" ? "wallet" : "doc"} size={20} />
      </div>
      <div className="setup-empty__title">
        {kind === "account" ? "연결된 광고 계정이 없어요" : "관리 중인 페이스북 페이지가 없어요"}
      </div>
      <div className="setup-empty__hint">
        {kind === "account"
          ? "Meta Business Manager에서 광고 계정을 먼저 만들어주세요."
          : "페이지 권한이 없거나 페이지가 없어요. 로그아웃 후 다시 로그인하면 페이지 접근 권한을 다시 요청해요."}
      </div>
    </div>
  );
}

export default function SetupPage() {
  const { update } = useSession();
  const [phase, setPhase] = useState<Phase>("account");
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [pages, setPages] = useState<FbPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/setup/ad-accounts")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setAccounts(data.accounts);
        setLoading(false);
      })
      .catch(() => {
        setError("광고 계정 목록을 불러오지 못했어요.");
        setLoading(false);
      });
  }, []);

  async function selectAccount(account: AdAccount) {
    setSelecting(account.id);
    setError(null);
    await update({ adAccountId: account.id, adAccountName: account.name });
    setLoading(true);
    try {
      const res = await fetch("/api/setup/pages");
      const data = await res.json();
      if (data.error) setError(data.error);
      else setPages(data.pages);
    } catch {
      setError("페이스북 페이지 목록을 불러오지 못했어요.");
    }
    setSelecting(null);
    setLoading(false);
    setPhase("page");
  }

  async function selectPage(page: FbPage) {
    setSelecting(page.id);
    await update({
      pageId: page.id,
      pageName: page.name,
      igUserId: page.igUserId ?? "",
      igUsername: page.igUsername ?? "",
      browseMode: false,
    });
    window.location.href = "/dashboard";
  }

  async function browseAround() {
    setSelecting("__browse__");
    await update({ browseMode: true });
    window.location.href = "/dashboard";
  }

  const isPage = phase === "page";

  return (
    <div className="adflow">
      <div className="setup-shell" data-screen-label="계정 연결">
        <div className="setup-card">
          <div className="setup-card__brand">
            <div className="setup-card__mark">A</div>
            <span className="setup-card__wordmark">AdFlow</span>
          </div>

          <div>
            <div className="setup-steps">
              <span className="setup-steps__seg setup-steps__seg--on" />
              <span className={"setup-steps__seg" + (isPage ? " setup-steps__seg--on" : "")} />
            </div>
            <span
              className="w-overline"
              style={{ display: "block", marginTop: 14, color: "var(--w-primary-normal)", letterSpacing: "0.1em" }}
            >
              {isPage ? "STEP 2 / 2 · 페이스북 페이지" : "STEP 1 / 2 · 광고 계정"}
            </span>
            <h1 className="setup-head__title" style={{ marginTop: 8 }}>
              {isPage ? "광고를 게재할 페이스북 페이지를 선택해주세요" : "광고 계정을 선택해주세요"}
            </h1>
            <p className="setup-head__sub">
              {isPage
                ? "선택한 페이지 명의로 광고 소재가 게재돼요."
                : "선택한 계정으로 광고를 집행하고 성과를 확인해요."}
            </p>
          </div>

          {loading && (
            <div className="setup-loading">
              <div className="spinner" />
              <span>불러오는 중…</span>
            </div>
          )}

          {error && (
            <div className="callout callout--warn">
              <Icon name="warn" size={16} />
              <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)" }}>{error}</div>
            </div>
          )}

          {!loading && !error && !isPage && accounts.length === 0 && <SetupEmpty kind="account" />}
          {!loading && !error && isPage && pages.length === 0 && <SetupEmpty kind="page" />}

          {!loading && !isPage && accounts.length > 0 && (
            <div className="picker-list">
              {accounts.map((account) => (
                <PickRow
                  key={account.id}
                  kind="account"
                  title={account.name}
                  meta={[account.id, account.currency]}
                  badge={account.account_status === 1 ? undefined : "비활성"}
                  busy={selecting === account.id}
                  dimmed={!!selecting && selecting !== account.id}
                  disabled={!!selecting}
                  onClick={() => selectAccount(account)}
                />
              ))}
            </div>
          )}

          {!loading && isPage && pages.length > 0 && (
            <div className="picker-list">
              {pages.map((page) => (
                <PickRow
                  key={page.id}
                  kind="page"
                  title={page.name}
                  meta={page.igUsername ? [page.id, `IG @${page.igUsername}`] : [page.id]}
                  busy={selecting === page.id}
                  dimmed={!!selecting && selecting !== page.id}
                  disabled={!!selecting}
                  onClick={() => selectPage(page)}
                />
              ))}
            </div>
          )}

          {isPage && !selecting && (
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              style={{ alignSelf: "flex-start" }}
              onClick={() => {
                setPhase("account");
                setError(null);
              }}
            >
              <Icon name="arrow-left" size={14} /> 광고 계정 다시 선택
            </button>
          )}

          <div className="divider" style={{ margin: "2px 0" }} />

          <div className="setup-foot">
            <button
              className="btn btn--secondary btn--sm"
              type="button"
              disabled={!!selecting}
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <Icon name="refresh" size={13} /> 다른 계정으로 로그인
            </button>
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              disabled={!!selecting}
              onClick={browseAround}
            >
              {selecting === "__browse__" ? "이동 중…" : "우선 둘러보기"}
              {selecting !== "__browse__" && <Icon name="arrow-right" size={13} />}
            </button>
          </div>
          <p className="setup-note">
            둘러보기 모드에선 소재 생성·화면 미리보기는 가능하지만, 실제 광고 집행은 광고 계정·페이지를 연결해야 해요.
          </p>
        </div>
      </div>
    </div>
  );
}
