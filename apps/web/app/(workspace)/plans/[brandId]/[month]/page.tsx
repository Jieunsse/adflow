"use client";

// 월간 계획 만들기 (기능명세 12-2). 실험 묶음과 총예산 상한을 적어 고객에게 승인을 요청한다.
// 요청한 뒤에는 고칠 수 없고, 고치려면 요청을 취소한다. 승인·반려된 계획은 "다시 만들기"로 작성 중으로 돌린다.
// 지난달 요약 칸은 성과 리포트(기능 6)가 생기면 넣는다.

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import { Skeleton } from "@shared/ui/Skeleton";
import { useToast } from "@shared/ui/Toast";
import { useBrandProfileStorage } from "@features/brand-profile/model/useBrandProfileStorage";
import {
  PLAN_STATUS_LABEL,
  monthLabel,
  parseBundles,
  planError,
  type Bundle,
  type MonthlyPlan,
} from "@entities/monthly-plan/model";

const INPUT =
  "w-full rounded-lg border border-[var(--w-line-normal)] p-3 text-[14px] text-[var(--w-fg-strong)] bg-[var(--w-bg-elevated)]";

export default function PlanEditorPage() {
  const { brandId, month } = useParams<{ brandId: string; month: string }>();
  const { data: session } = useSession();
  const { profiles } = useBrandProfileStorage();
  const brandName = profiles.find((p) => p.id === brandId)?.name ?? "브랜드";
  const url = `/api/plans/${encodeURIComponent(brandId)}/${month}`;

  const q = useQuery({
    queryKey: ["plan", brandId, month],
    queryFn: async (): Promise<MonthlyPlan | null> => {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("월간 계획을 불러오지 못했어요.");
      return (await res.json()) as MonthlyPlan;
    },
    enabled: !session?.browseMode,
  });

  return (
    <div className="px-12 py-9 pb-16 max-w-[800px] w-full mx-auto flex flex-col gap-6" data-screen-label="월간 계획 만들기">
      <div>
        <Link href="/plans" className="font-medium text-[13px] text-[var(--w-fg-neutral)] underline">
          이번 달 광고 계획
        </Link>
        <h1 className="m-0 mt-1 font-bold text-[28px] leading-[1.25] text-[var(--w-fg-strong)]">
          {brandName} · {monthLabel(month)} 계획
        </h1>
      </div>

      {session?.browseMode ? (
        <Card className="py-8 px-6 font-medium text-[13px] text-[var(--w-fg-neutral)]">둘러보기에서는 월간 계획을 저장하지 않아요.</Card>
      ) : q.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : q.isError ? (
        <Card className="py-8 px-6 font-medium text-[13px] text-[var(--w-fg-neutral)]">
          월간 계획을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
        </Card>
      ) : (
        <PlanForm
          key={q.data?.status ?? "new"}
          plan={q.data ?? null}
          url={url}
          canEdit={session?.role === "팀장" || session?.role === "팀원·게재"}
          queryKey={["plan", brandId, month]}
        />
      )}
    </div>
  );
}

function PlanForm({ plan, url, canEdit, queryKey }: {
  plan: MonthlyPlan | null;
  url: string;
  canEdit: boolean;
  queryKey: string[];
}) {
  const qc = useQueryClient();
  const showToast = useToast();
  const [bundles, setBundles] = useState<Bundle[]>(() => parseBundles(plan?.bundles));
  const [capText, setCapText] = useState(plan?.budgetCap ? String(plan.budgetCap) : "");
  const [message, setMessage] = useState(plan?.messageToClient ?? "");
  const [busy, setBusy] = useState(false);

  const status = plan?.status ?? "draft";
  const locked = status !== "draft" || !canEdit;
  const sum = bundles.reduce((a, b) => a + b.budget, 0);
  const cap = capText ? Number(capText) : sum;

  const update = (i: number, patch: Partial<Bundle>) =>
    setBundles((list) => list.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const call = async (path: string, method: "PUT" | "POST", ok: string, body?: object) => {
    setBusy(true);
    try {
      const res = await fetch(`${url}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) throw new Error(await planError(res, "저장하지 못했어요. 잠시 뒤 다시 해 주세요."));
      showToast(ok);
      await qc.invalidateQueries({ queryKey });
      await qc.invalidateQueries({ queryKey: ["plans"] });
      return true;
    } catch (e) {
      showToast(e instanceof Error ? e.message : "저장하지 못했어요.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = (ok = "임시 저장했어요") =>
    call("", "PUT", ok, { budgetCap: cap, bundles: JSON.stringify(bundles), messageToClient: message });

  const requestApproval = async () => {
    if (await save("임시 저장했어요")) await call("/request", "POST", "고객에게 승인을 요청했어요");
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Chip variant={status === "approved" ? "success" : status === "rejected" ? "neg" : status === "requested" ? "review" : "neutral"}>
          {PLAN_STATUS_LABEL[status]}
        </Chip>
        {plan?.decidedBy && (
          <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">
            {plan.decidedBy} · {plan.decidedAt ? new Date(plan.decidedAt).toLocaleDateString("ko-KR") : ""}
          </span>
        )}
      </div>

      {plan?.status === "rejected" && plan.rejectReason && (
        <Card className="p-4 font-medium text-[14px] text-[var(--w-fg-strong)]">고객이 반려한 이유 · {plan.rejectReason}</Card>
      )}

      <Card className="p-5 flex flex-col gap-4">
        <h2 className="m-0 font-semibold text-[16px] text-[var(--w-fg-strong)]">실험 묶음</h2>
        {bundles.length === 0 && (
          <p className="m-0 font-medium text-[13px] text-[var(--w-fg-neutral)]">아직 묶음이 없어요. 이번 달에 할 실험을 묶음으로 추가해 주세요.</p>
        )}
        {bundles.map((b, i) => (
          <div key={i} className="grid grid-cols-2 gap-3 border-b border-[var(--w-line-alternative)] pb-4">
            <Field label="목표" value={b.goal} disabled={locked} onChange={(v) => update(i, { goal: v })} />
            <Field label="상품" value={b.product} disabled={locked} onChange={(v) => update(i, { product: v })} />
            <Field label="시험할 요소 후보" value={b.axes} disabled={locked} onChange={(v) => update(i, { axes: v })} />
            <Field
              label="예상 예산(원)"
              value={b.budget ? String(b.budget) : ""}
              inputMode="numeric"
              disabled={locked}
              onChange={(v) => update(i, { budget: Number(v.replace(/\D/g, "")) || 0 })}
            />
            {!locked && (
              <div className="col-span-2 flex justify-end">
                <Button variant="secondary" type="button" onClick={() => setBundles((l) => l.filter((_, j) => j !== i))}>
                  삭제하기
                </Button>
              </div>
            )}
          </div>
        ))}
        {!locked && (
          <div>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setBundles((l) => [...l, { goal: "", product: "", axes: "", budget: 0 }])}
            >
              묶음 추가하기
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-5 flex flex-col gap-2">
        <label htmlFor="cap" className="font-semibold text-[16px] text-[var(--w-fg-strong)]">총예산 상한(원)</label>
        <input
          id="cap"
          className={INPUT}
          inputMode="numeric"
          disabled={locked}
          value={capText}
          placeholder={sum ? String(sum) : ""}
          onChange={(e) => setCapText(e.target.value.replace(/\D/g, ""))}
        />
        <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">
          비워 두면 묶음 예상 예산의 합({sum.toLocaleString("ko-KR")}원)을 써요.
        </span>
      </Card>

      <Card className="p-5 flex flex-col gap-2">
        <label htmlFor="msg" className="font-semibold text-[16px] text-[var(--w-fg-strong)]">고객에게 하는 말 (3줄 이하)</label>
        <textarea
          id="msg"
          className={INPUT}
          rows={3}
          maxLength={500}
          disabled={locked}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Card>

      {canEdit ? (
        <div className="flex justify-end gap-2">
          {status === "draft" && (
            <>
              <Button variant="secondary" type="button" disabled={busy} onClick={() => save()}>저장하기</Button>
              <Button variant="primary" type="button" disabled={busy || cap < 1} onClick={requestApproval}>요청하기</Button>
            </>
          )}
          {status === "requested" && (
            <Button variant="secondary" type="button" disabled={busy} onClick={() => call("/cancel", "POST", "요청을 취소했어요")}>
              요청 취소하기
            </Button>
          )}
          {(status === "approved" || status === "rejected") && (
            <Button variant="secondary" type="button" disabled={busy} onClick={() => call("/reopen", "POST", "작성 중으로 돌렸어요")}>
              다시 만들기
            </Button>
          )}
        </div>
      ) : (
        <p className="m-0 font-medium text-[13px] text-[var(--w-fg-neutral)]">월간 계획은 팀장과 팀원·게재만 고칠 수 있어요.</p>
      )}
    </>
  );
}

function Field({ label, value, onChange, disabled, inputMode }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  inputMode?: "numeric";
}) {
  return (
    <label className="flex flex-col gap-1 font-semibold text-[13px] text-[var(--w-fg-strong)]">
      {label}
      <input className={INPUT} value={value} disabled={disabled} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
