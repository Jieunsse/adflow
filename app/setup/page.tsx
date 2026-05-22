"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";

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
  const iconBg =
    kind === "account"
      ? "bg-[var(--w-primary-soft)] text-[var(--w-primary-press)]"
      : "bg-[rgba(101,65,242,0.14)] text-[var(--w-accent-violet)]";

  return (
    <button
      type="button"
      className="flex items-center gap-3 px-3 py-3 bg-transparent border border-transparent rounded-[10px] cursor-pointer text-left w-full hover:bg-[var(--w-bg-alternative)] hover:border-[var(--w-line-alternative)]"
      onClick={onClick}
      disabled={disabled}
      style={{ opacity: dimmed ? 0.45 : 1, cursor: disabled ? "default" : "pointer" }}
    >
      <div className={`w-8 h-8 rounded-[9px] grid place-items-center flex-[0_0_auto] ${iconBg}`}>
        <Icon name={kind === "account" ? "wallet" : "doc"} size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div className="flex items-center gap-2 font-semibold text-[13.5px] leading-[1.3] text-[var(--w-fg-strong)]">
          {title}
          {badge && (
            <span className="font-semibold text-[10px] leading-none [font-family:var(--w-font-mono)] bg-[rgba(255,146,0,0.12)] text-[var(--w-status-cautionary)] px-1.5 py-[3px] rounded-[4px] tracking-[0.04em]">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap [font-family:var(--w-font-mono)] text-[11.5px] leading-[1.3] text-[var(--w-fg-neutral)] mt-1">
          {meta.map((m, i) => (
            <span key={m} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <span className="w-[3px] h-[3px] rounded-full bg-[var(--w-fg-alternative)]" />}
              <span>{m}</span>
            </span>
          ))}
        </div>
      </div>
      {busy ? (
        <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[16px] h-[16px]" />
      ) : (
        <Icon name="arrow-right" size={14} style={{ color: "var(--w-fg-alternative)", flex: "0 0 auto" }} />
      )}
    </button>
  );
}

function SetupEmpty({ kind }: { kind: "account" | "page" }) {
  return (
    <div className="border border-dashed border-[var(--w-line-normal)] rounded-xl px-5 py-[26px] flex flex-col items-center gap-2.5 text-center">
      <div className="w-11 h-11 rounded-xl bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)] grid place-items-center">
        <Icon name={kind === "account" ? "wallet" : "doc"} size={20} />
      </div>
      <div className="font-bold text-[14.5px] leading-[1.35] [font-family:var(--w-font-display)] text-[var(--w-fg-strong)]">
        {kind === "account" ? "연결된 광고 계정이 없어요" : "관리 중인 페이스북 페이지가 없어요"}
      </div>
      <div className="font-medium text-[12.5px] leading-[1.55] text-[var(--w-fg-neutral)] max-w-[320px]">
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
    <div
      className="[font-family:var(--w-font-sans)] [color:var(--w-fg-normal)] [background:var(--w-bg-alternative)] text-[14px] min-h-screen [color-scheme:light] [-webkit-font-smoothing:antialiased] [text-rendering:optimizeLegibility]"
      style={{ colorScheme: "light" }}
    >
      <div
        className="min-h-screen grid place-items-center px-6 py-12 relative z-[1] [background:radial-gradient(ellipse_720px_380px_at_50%_-8%,rgba(0,102,255,0.07),transparent_70%),radial-gradient(ellipse_520px_320px_at_88%_112%,rgba(101,65,242,0.06),transparent_70%),var(--w-bg-normal)]"
        data-screen-label="계정 연결"
      >
        <div className="w-full max-w-[460px] bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-[20px] shadow-[var(--w-shadow-card)] px-8 pt-8 pb-[26px] flex flex-col gap-[22px]">
          <div className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-[10px] [background:linear-gradient(135deg,var(--w-primary-normal),var(--w-accent-violet))] text-white grid place-items-center font-[800] text-[16px] leading-none [font-family:var(--w-font-display)] tracking-[-0.03em]">A</div>
            <span className="font-[800] text-[17px] leading-none [font-family:var(--w-font-display)] text-[var(--w-fg-strong)] tracking-[-0.022em]">AdFlow</span>
          </div>

          <div>
            <div className="flex gap-1.5">
              <span className="flex-1 h-1 rounded-sm bg-[var(--w-primary-normal)] transition-[background] duration-[160ms]" />
              <span className={`flex-1 h-1 rounded-sm transition-[background] duration-[160ms] ${isPage ? "bg-[var(--w-primary-normal)]" : "bg-[var(--w-line-neutral)]"}`} />
            </div>
            <span
              className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-primary-normal)] block"
              style={{ marginTop: 14, letterSpacing: "0.1em" }}
            >
              {isPage ? "STEP 2 / 2 · 페이스북 페이지" : "STEP 1 / 2 · 광고 계정"}
            </span>
            <h1 className="font-[800] text-[21px] leading-[1.3] [font-family:var(--w-font-display)] text-[var(--w-fg-strong)] tracking-[-0.02em] m-0" style={{ marginTop: 8 }}>
              {isPage ? "광고를 게재할 페이스북 페이지를 선택해주세요" : "광고 계정을 선택해주세요"}
            </h1>
            <p className="font-medium text-[13.5px] leading-[1.55] text-[var(--w-fg-neutral)] mt-2 mb-0">
              {isPage
                ? "선택한 페이지 명의로 광고 소재가 게재돼요."
                : "선택한 계정으로 광고를 집행하고 성과를 확인해요."}
            </p>
          </div>

          {loading && (
            <div className="flex flex-col items-center gap-3 py-[34px] text-[var(--w-fg-neutral)] font-medium text-[13px] leading-[1.4]">
              <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[18px] h-[18px]" />
              <span>불러오는 중…</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 px-[14px] py-3 rounded-[10px] border border-transparent bg-[rgba(255,146,0,0.10)] border-[rgba(255,146,0,0.24)] text-[var(--w-status-cautionary)]">
              <Icon name="warn" size={16} />
              <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)" }}>{error}</div>
            </div>
          )}

          {!loading && !error && !isPage && accounts.length === 0 && <SetupEmpty kind="account" />}
          {!loading && !error && isPage && pages.length === 0 && <SetupEmpty kind="page" />}

          {!loading && !isPage && accounts.length > 0 && (
            <div className="flex flex-col gap-1 max-h-[380px] overflow-y-auto py-1 pb-3">
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
            <div className="flex flex-col gap-1 max-h-[380px] overflow-y-auto py-1 pb-3">
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
            <Button
              variant="ghost"
              size="sm"
              type="button"
              style={{ alignSelf: "flex-start" }}
              onClick={() => {
                setPhase("account");
                setError(null);
              }}
            >
              <Icon name="arrow-left" size={14} /> 광고 계정 다시 선택
            </Button>
          )}

          <hr className="h-px bg-[var(--w-line-neutral)] my-0 border-0" style={{ margin: "2px 0" }} />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              disabled={!!selecting}
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <Icon name="refresh" size={13} /> 다른 계정으로 로그인
            </Button>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={!!selecting}
              onClick={browseAround}
            >
              {selecting === "__browse__" ? "이동 중…" : "우선 둘러보기"}
              {selecting !== "__browse__" && <Icon name="arrow-right" size={13} />}
            </Button>
          </div>
          <p className="font-medium text-[11.5px] leading-[1.6] text-[var(--w-fg-alternative)] m-0">
            둘러보기 모드에선 소재 생성·화면 미리보기는 가능하지만, 실제 광고 집행은 광고 계정·페이지를 연결해야 해요.
          </p>
        </div>
      </div>
    </div>
  );
}
