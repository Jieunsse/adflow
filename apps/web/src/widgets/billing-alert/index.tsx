"use client";

// PRD-billing §6 — dashboard/billing 공용 결제 경고 칩.
// TODO(members): owner-only gate — members PRD 출시 시 비오너에게 노출 여부 결정.

import Link from "next/link";
import Icon from "@shared/ui/Icon";
import { Card } from "@shared/ui/Card";
import { buttonVariants } from "@shared/ui/Button";
import type { Billing } from "@entities/billing/types";
import {
  computeBillingAlerts,
  type BillingAlert,
} from "@entities/billing/alerts";

interface Props {
  billing: Billing | null | undefined;
  // 'top'   = 우선순위 최상위 1건만 (dashboard)
  // 'all'   = 발동된 모든 칩 (billing 페이지 안)
  mode: "top" | "all";
}

export default function BillingAlertWidget({ billing, mode }: Props) {
  if (!billing) return null;
  const alerts = computeBillingAlerts(billing);
  if (alerts.length === 0) return null;
  const visible = mode === "top" ? alerts.slice(0, 1) : alerts;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {visible.map((a) => (
        <AlertCard key={a.id} alert={a} showCta={mode === "top"} />
      ))}
    </div>
  );
}

function AlertCard({
  alert,
  showCta,
}: {
  alert: BillingAlert;
  showCta: boolean;
}) {
  const isNegative = alert.severity === "negative";
  const accent = isNegative
    ? "var(--w-status-negative)"
    : "var(--w-status-cautionary)";
  const tint = isNegative ? "rgba(255,66,66,0.05)" : "rgba(255,146,0,0.05)";
  const iconBg = isNegative ? "rgba(255,66,66,0.15)" : "rgba(255,146,0,0.15)";
  return (
    <Card
      className="flex items-center gap-4"
      style={{ borderColor: accent, background: tint }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: iconBg,
          color: accent,
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
        }}
      >
        <Icon name="warn" size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "600 14.5px/1.3 var(--w-font-sans)",
            color: "var(--w-fg-strong)",
          }}
        >
          {alert.message}
        </div>
        <div
          style={{
            font: "500 12.5px/1.5 var(--w-font-sans)",
            color: "var(--w-fg-neutral)",
            marginTop: 3,
          }}
        >
          청구 및 결제 페이지에서 확인하고 Meta 결제 페이지로 이동해 처리할 수
          있어요.
        </div>
      </div>
      {showCta && (
        <Link
          href="/billing"
          className={buttonVariants({ variant: "primary", size: "sm" })}
        >
          <span style={{ color: "#fff" }}>청구 및 결제로 가기</span>
        </Link>
      )}
    </Card>
  );
}
