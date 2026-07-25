"use client";

// PRD-billing — 청구 및 결제 페이지. 카드 5장 + 거래내역 deeplink + 고객센터 링크.
// 모든 변경 액션은 Meta 결제 페이지 deeplink (인앱 변경 0).
// TODO(members): owner-only gate — members PRD 출시 시 라우트 권한 게이트 추가.

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Icon, { type IconName } from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import { Skeleton } from "@shared/ui/Skeleton";
import { fmt } from "@shared/lib/format";
import BillingAlertWidget from "@widgets/billing-alert";
import type { Billing } from "@entities/billing/types";
import { accountStatusLabel, fundingSourceTypeLabel } from "@entities/billing/labels";
import { BILLING_HELP_LINKS } from "@entities/billing/help-links";

const META_BILLING_HUB = "https://business.facebook.com/billing_hub";

// session.adAccountId 는 'act_123' 형태 — Meta deeplink 의 asset_id 는 접두사 없는 숫자만.
function toAssetId(accountId: string): string {
  return accountId.replace(/^act_/, "");
}

function deeplink(path: "payment_settings" | "payment_methods" | "accounts/details", accountId: string): string {
  return `${META_BILLING_HUB}/${path}?asset_id=${toAssetId(accountId)}`;
}

async function fetchBilling(): Promise<Billing> {
  const res = await fetch("/api/billing");
  const data = await res.json();
  if (res.status === 401) {
    throw Object.assign(new Error(data?.error ?? "광고 계정을 먼저 연결해주세요."), { code: 401 });
  }
  if (!res.ok) throw new Error(data?.error ?? "결제 정보를 불러오지 못했어요");
  return data as Billing;
}

function formatMoney(amount: number | null, currency: string): string {
  if (amount == null) return "—";
  // 본 PRD 는 KRW(minor=0) 만 가정 — 다른 통화는 정수 그대로 + 코드 라벨 (§2.2 비목표).
  return `${currency === "KRW" ? "₩" : ""}${fmt(amount)}`;
}

export default function BillingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  // 둘러보기 모드는 mock billing 으로 카드 5장 UI 구조만 보여줌 (api/billing 라우트가 분기 처리).
  const connected = !!session?.adAccountId || !!session?.browseMode;
  const q = useQuery({
    queryKey: ["billing"],
    queryFn: fetchBilling,
    enabled: connected,
    staleTime: 60_000, // PRD §12 미정 #4 — 결제 정보 변화 빈도 낮음
  });

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label="청구 및 결제">
      <div className="flex justify-between items-end gap-6">
        <div>
          <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">워크스페이스</span>
          <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]" style={{ marginTop: 4 }}>청구 및 결제</h1>
          <p className="font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-neutral)] mt-1.5 mb-0">광고 계정의 결제 정보를 확인할 수 있어요. 변경은 Meta 결제 페이지에서 안전하게 진행돼요.</p>
        </div>
      </div>

      {!connected ? (
        <EmptyCard
          icon="link"
          title="광고 계정을 먼저 연결해주세요"
          reason="Meta 광고 계정을 연결하면 잔액·한도·결제 수단 정보를 확인할 수 있어요."
          ctaLabel="계정 연결로 가기"
          onAction={() => router.push("/connect")}
        />
      ) : (q.error as { code?: number } | null)?.code === 401 ? (
        <EmptyCard
          icon="lock"
          title="로그인이 만료됐어요"
          reason="다시 로그인하면 결제 정보를 불러올 수 있어요."
          ctaLabel="로그아웃하러 가기"
          onAction={() => router.push("/settings")}
        />
      ) : q.isError ? (
        <EmptyCard
          icon="warn"
          title="결제 정보를 불러오지 못했어요"
          reason={q.error instanceof Error ? q.error.message : "잠시 후 다시 시도해 주세요"}
          ctaLabel="다시 시도"
          onAction={() => q.refetch()}
        />
      ) : q.isLoading || !q.data ? (
        <CardsSkeleton />
      ) : (
        <BillingContent billing={q.data} />
      )}
    </div>
  );
}

function BillingContent({ billing }: { billing: Billing }) {
  const accountId = billing.accountId;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BillingAlertWidget billing={billing} mode="all" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <BalanceCard billing={billing} accountId={accountId} />
        <SpendCapCard billing={billing} accountId={accountId} />
        <FundingSourceCard billing={billing} accountId={accountId} />
        <BusinessInfoCard billing={billing} accountId={accountId} />
        <BillingNoticeCard billing={billing} accountId={accountId} />
        <TransactionsCard accountId={accountId} />
      </div>

      <HelpLinksSection />
    </div>
  );
}

// ── 카드 1: 현재 미결제 금액 ────────────────────────────────────────────
function BalanceCard({ billing, accountId }: { billing: Billing; accountId: string }) {
  return (
    <CardShell title="현재 미결제 금액" hint="아직 청구되지 않은 잔액이에요.">
      <div style={{ font: "700 32px/1.1 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.012em" }}>
        {formatMoney(billing.balance, billing.currency)}
      </div>
      <div style={{ font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-alternative)", marginTop: 8 }}>
        통화: {billing.currency || "—"}
      </div>
      <DeeplinkButton href={deeplink("payment_settings", accountId)} label="Meta 결제 페이지에서 보기" />
    </CardShell>
  );
}

// ── 카드 2: 계정 지출 한도 ─────────────────────────────────────────────
function SpendCapCard({ billing, accountId }: { billing: Billing; accountId: string }) {
  const { spendCap, amountSpent, currency } = billing;
  const hasCap = spendCap != null && spendCap > 0 && amountSpent != null;
  const ratio = hasCap ? Math.min(amountSpent! / spendCap!, 1.5) : 0;
  const pct = hasCap ? Math.floor((amountSpent! / spendCap!) * 100) : 0;
  const color =
    !hasCap ? "var(--w-fg-alternative)" :
    ratio >= 1 ? "var(--w-status-negative)" :
    ratio >= 0.8 ? "var(--w-status-cautionary)" :
    "var(--w-status-positive)";

  return (
    <CardShell title="계정 지출 한도" hint="이 한도까지 누적 지출이 차면 광고가 자동으로 멈춰요.">
      {hasCap ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ font: "700 22px/1 var(--w-font-mono)", color: "var(--w-fg-strong)" }}>
              {formatMoney(amountSpent!, currency)}
            </span>
            <span style={{ font: "500 13px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
              / {formatMoney(spendCap!, currency)}
            </span>
            <span style={{ font: "600 13px/1 var(--w-font-mono)", color, marginLeft: "auto" }}>{pct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "var(--w-bg-alternative)", marginTop: 12, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, transition: "width 200ms ease" }} />
          </div>
          {ratio >= 1 && (
            <div style={{ marginTop: 10, font: "600 12px/1.4 var(--w-font-sans)", color: "var(--w-status-negative)" }}>
              한도 도달 — 광고가 멈췄을 수 있어요
            </div>
          )}
        </>
      ) : (
        <div style={{ font: "500 13.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
          한도 미설정 — 한도를 설정하면 광고 비용을 통제할 수 있어요.
        </div>
      )}
      <DeeplinkButton href={deeplink("payment_settings", accountId)} label="Meta 결제 페이지에서 변경" />
    </CardShell>
  );
}

// ── 카드 3: 결제 수단 ─────────────────────────────────────────────────
function FundingSourceCard({ billing, accountId }: { billing: Billing; accountId: string }) {
  const sources = billing.fundingSources;
  return (
    <CardShell title="결제 수단" hint="청구 시 자동으로 결제되는 카드/계좌예요.">
      {sources.length === 0 ? (
        <div style={{ font: "600 13.5px/1.55 var(--w-font-sans)", color: "var(--w-status-negative)" }}>
          등록된 결제 수단이 없어요. 광고를 시작하거나 연장하려면 결제 수단을 추가해야 해요.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sources.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--w-line-alternative)", borderRadius: 10, background: "var(--w-bg-elevated)" }}>
              <Icon name="wallet" size={16} style={{ color: "var(--w-fg-neutral)" }} />
              <span style={{ flex: 1, font: "600 13px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
                {s.displayString || "—"}
              </span>
              {s.type && (
                <Chip variant="neutral" className="text-[11px] [font-family:var(--w-font-mono)] font-medium">{fundingSourceTypeLabel(s.type)}</Chip>
              )}
            </div>
          ))}
        </div>
      )}
      <DeeplinkButton href={deeplink("payment_methods", accountId)} label="Meta 결제 페이지에서 추가/변경" />
    </CardShell>
  );
}

// ── 카드 4: 비즈니스 정보 ──────────────────────────────────────────────
function BusinessInfoCard({ billing, accountId }: { billing: Billing; accountId: string }) {
  const rows: { label: string; value: string }[] = [
    { label: "사업자명", value: billing.business.name ?? "—" },
    { label: "주소", value: [billing.business.street, billing.business.city, billing.business.state].filter(Boolean).join(", ") || "—" },
    { label: "우편번호", value: billing.business.zip ?? "—" },
    { label: "국가", value: billing.business.countryCode ?? "—" },
    { label: "통화", value: billing.currency || "—" },
  ];
  return (
    <CardShell title="비즈니스 정보" hint="세금계산서·영수증에 표시되는 정보예요.">
      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", rowGap: 10, columnGap: 12 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "contents" }}>
            <div style={{ font: "500 12px/1.3 var(--w-font-sans)", color: "var(--w-fg-alternative)" }}>{r.label}</div>
            <div style={{ font: "600 13px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{r.value}</div>
          </div>
        ))}
      </div>
      <DeeplinkButton href={deeplink("payment_settings", accountId)} label="Meta 비즈니스 설정에서 변경" />
    </CardShell>
  );
}

// ── 카드 5: 청구 알림 ─────────────────────────────────────────────────
function BillingNoticeCard({ billing, accountId }: { billing: Billing; accountId: string }) {
  const active = billing.accountStatus === 1;
  const color = active ? "var(--w-status-positive)" : "var(--w-status-negative)";
  return (
    <CardShell title="청구 알림" hint="결제 관련 계정 상태를 알려드려요.">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
        <span style={{ font: "600 14px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
          {active ? "문제가 발견되지 않았습니다" : `광고 계정 상태: ${accountStatusLabel(billing.accountStatus)}`}
        </span>
      </div>
      <div style={{ font: "500 12.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 8 }}>
        {active
          ? "결제 수단과 잔액에 문제가 없어요. 광고 게재가 정상적으로 유지돼요."
          : "결제 관련 문제로 광고가 중단됐을 수 있어요. Meta 결제 페이지에서 자세한 내용을 확인해주세요."}
      </div>
      {!active && (
        <DeeplinkButton href={deeplink("payment_settings", accountId)} label="Meta 결제 페이지에서 확인" />
      )}
    </CardShell>
  );
}

// ── 거래 내역 (deeplink only) ─────────────────────────────────────────
function TransactionsCard({ accountId }: { accountId: string }) {
  return (
    <CardShell title="거래 내역" hint="결제 활동·영수증은 Meta 페이지에서 볼 수 있어요.">
      <div style={{ font: "500 13px/1.55 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
        AdFlow 안에서는 거래 내역을 표시하지 않아요. 정확한 청구 기록은 Meta 결제 페이지에서 직접 확인해주세요.
      </div>
      <DeeplinkButton href={deeplink("accounts/details", accountId)} label="Meta 에서 거래 내역 보기" />
    </CardShell>
  );
}

// ── 고객센터 ─────────────────────────────────────────────────────────
function HelpLinksSection() {
  return (
    <Card>
      <div style={{ font: "600 14px/1 var(--w-font-sans)", color: "var(--w-fg-strong)", marginBottom: 4 }}>
        고객센터
      </div>
      <div style={{ font: "500 12px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginBottom: 14 }}>
        결제 관련 도움이 필요할 때 참고할 수 있는 Meta 공식 문서 모음이에요.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {BILLING_HELP_LINKS.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "1px solid var(--w-line-alternative)", borderRadius: 10, textDecoration: "none", color: "var(--w-fg-strong)", font: "500 13px/1.3 var(--w-font-sans)" }}>
            <Icon name="doc" size={14} style={{ color: "var(--w-fg-neutral)" }} />
            <span style={{ flex: 1 }}>{link.label}</span>
            <Icon name="arrow-right" size={14} style={{ color: "var(--w-fg-alternative)" }} />
          </a>
        ))}
      </div>
    </Card>
  );
}

// ── 공통 ──────────────────────────────────────────────────────────────
function CardShell({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-2.5">
      <div>
        <div style={{ font: "600 14px/1.2 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{title}</div>
        {hint && (
          <div style={{ font: "500 12px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>{hint}</div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{children}</div>
    </Card>
  );
}

function DeeplinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        marginTop: "auto",
        alignSelf: "flex-end",
        padding: "8px 14px",
        font: "600 12.5px/1 var(--w-font-sans)",
        color: "var(--w-primary-normal)",
        textDecoration: "none",
        background: "var(--w-bg-elevated)",
        border: "1px solid var(--w-line-normal)",
        borderRadius: 8,
      }}>
      {label}
    </a>
  );
}

function EmptyCard({ icon, title, reason, ctaLabel, onAction }: { icon: IconName; title: string; reason: string; ctaLabel: string; onAction: () => void }) {
  return (
    <Card className="py-10 px-8 flex flex-col items-center gap-3 text-center">
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0,102,255,0.10)", color: "var(--w-primary-normal)", display: "grid", placeItems: "center" }}>
        <Icon name={icon} size={24} />
      </div>
      <div style={{ font: "700 17px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", letterSpacing: "-0.01em" }}>{title}</div>
      <div style={{ font: "500 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", maxWidth: 380 }}>{reason}</div>
      <Button variant="primary" type="button" className="mt-2" onClick={onAction}>{ctaLabel}</Button>
    </Card>
  );
}

function CardsSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Card key={i} className="flex flex-col gap-2">
          <Skeleton className="h-[14px] w-[120px]" />
          <Skeleton className="h-[11px] w-[220px]" />
          <Skeleton className="h-[30px] w-[160px] mt-2" />
          <Skeleton className="h-[11px] w-[100px]" />
        </Card>
      ))}
    </div>
  );
}
