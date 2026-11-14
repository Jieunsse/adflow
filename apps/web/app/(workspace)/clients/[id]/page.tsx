"use client";

// 고객사 상세 (기능명세 14-2). 개요·상담 메모·계약·청구(팀장만) 탭.
// shortcut: 진단 탭(지난 광고 가져오기·진단서 파일)은 기능 9 를 만들 때 붙인다.

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
import {
  INQUIRY_SOURCES,
  STAGES,
  clientsApi,
  stageLabel,
  won,
  type Client,
  type ClientBill,
  type ClientMemo,
  type ClientView,
  type Settlement,
} from "@entities/client/model";

type Tab = "overview" | "memos" | "contract" | "bills";

const INPUT = "rounded-lg border border-[var(--w-line-normal)] p-2.5 text-[14px] font-medium text-[var(--w-fg-strong)] bg-[var(--w-bg-elevated)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 font-semibold text-[13px] text-[var(--w-fg-strong)]">
      {label}
      {children}
    </label>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const isLead = session?.role === "팀장";
  const qc = useQueryClient();
  const showToast = useToast();
  const [tab, setTab] = useState<Tab>("overview");

  const q = useQuery({
    queryKey: ["client", id],
    queryFn: () => clientsApi<ClientView>(`/${id}`),
    enabled: !!session && !session.browseMode,
  });

  const run = async (op: Promise<unknown>, ok: string) => {
    try {
      await op;
      showToast(ok);
      await qc.invalidateQueries({ queryKey: ["client", id] });
      await qc.invalidateQueries({ queryKey: ["clients"] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "저장하지 못했어요.");
    }
  };

  if (q.isLoading || !session) return <div className="px-12 py-9"><Skeleton className="h-40 w-full" /></div>;
  if (!q.data) {
    return (
      <div className="px-12 py-9">
        <Card className="py-8 px-6 font-medium text-[13px] text-[var(--w-fg-neutral)]">고객사를 찾지 못했어요. 목록에서 다시 골라 주세요.</Card>
      </div>
    );
  }
  const { client: c, overdue } = q.data;
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "개요" },
    { key: "memos", label: "상담 메모" },
    { key: "contract", label: "계약" },
    ...(isLead ? [{ key: "bills" as Tab, label: "청구" }] : []),
  ];

  return (
    <div className="px-12 py-9 pb-16 max-w-[960px] w-full mx-auto flex flex-col gap-6" data-screen-label="고객사 상세">
      <div className="flex justify-between items-end gap-4">
        <div>
          <Link href="/clients" className="font-semibold text-[12px] text-[var(--w-fg-neutral)]">← 고객사 관리</Link>
          <h1 className="m-0 mt-1 font-bold text-[26px] text-[var(--w-fg-strong)]">{c.name}</h1>
          <div className="flex gap-2 mt-2">
            <Chip variant="neutral">{stageLabel(c.stage)}</Chip>
            {overdue && <Chip variant="neg">입금 늦음</Chip>}
            {c.brandProfileId && <Chip variant="success">브랜드 있음</Chip>}
          </div>
        </div>
        <Field label="단계 바꾸기">
          <select
            value={c.stage}
            className={INPUT}
            onChange={(e) => run(clientsApi(`/${id}/stage`, "POST", { stage: e.target.value }), "단계를 바꿨어요")}
          >
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="flex gap-2" role="tablist">
        {tabs.map((t) => (
          <Button key={t.key} role="tab" aria-selected={tab === t.key} variant={tab === t.key ? "primary" : "secondary"} type="button" onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "overview" && <ClientForm key={c.id + "o"} c={c} fields="overview" onSave={(next) => run(clientsApi(`/${id}`, "PUT", next), "저장했어요")} />}
      {tab === "contract" && <ClientForm key={c.id + "c"} c={c} fields="contract" onSave={(next) => run(clientsApi(`/${id}`, "PUT", next), "저장했어요")} />}
      {tab === "memos" && <Memos id={id} />}
      {tab === "bills" && isLead && <Bills id={id} c={c} />}
    </div>
  );
}

function ClientForm({ c, fields, onSave }: { c: Client; fields: "overview" | "contract"; onSave: (c: Client) => void }) {
  const [v, setV] = useState<Client>(c);
  const set = <K extends keyof Client>(k: K, val: Client[K]) => setV((p) => ({ ...p, [k]: val }));
  const text = (k: keyof Client, label: string, type = "text") => (
    <Field label={label}>
      <input
        type={type}
        value={(v[k] as string | number | undefined) ?? ""}
        onChange={(e) => set(k, (type === "number" ? (e.target.value ? Number(e.target.value) : undefined) : e.target.value || undefined) as never)}
        className={INPUT}
      />
    </Field>
  );

  return (
    <Card className="p-5 grid grid-cols-2 gap-4">
      {fields === "overview" ? (
        <>
          {text("name", "회사 이름")}
          {text("contact", "연락처")}
          {text("industry", "업종")}
          <Field label="문의 경로">
            <select value={v.inquirySource ?? ""} onChange={(e) => set("inquirySource", e.target.value || undefined)} className={INPUT}>
              <option value="">고르지 않음</option>
              {INQUIRY_SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          {text("managerEmail", "담당 직원 이메일")}
          {text("nextAction", "다음 할 일")}
          {text("nextActionDate", "다음 할 일 날짜", "date")}
          <div className="flex flex-col gap-2 justify-end">
            <label className="flex items-center gap-2 font-medium text-[13px]"><input type="checkbox" checked={!!v.caseStudyConsent} onChange={(e) => set("caseStudyConsent", e.target.checked)} /> 사례 공개에 동의했어요</label>
            <label className="flex items-center gap-2 font-medium text-[13px]"><input type="checkbox" checked={!!v.excludedIndustry} onChange={(e) => set("excludedIndustry", e.target.checked)} /> 받지 않는 업종이에요</label>
          </div>
        </>
      ) : (
        <>
          <Field label="상품">
            <select value={v.product ?? ""} onChange={(e) => set("product", (e.target.value || undefined) as Client["product"])} className={INPUT}>
              <option value="">고르지 않음</option>
              <option value="light">라이트</option>
              <option value="standard">스탠다드</option>
            </select>
          </Field>
          <Field label="청구 방식">
            <select value={v.billingType ?? ""} onChange={(e) => set("billingType", (e.target.value || undefined) as Client["billingType"])} className={INPUT}>
              <option value="">고르지 않음</option>
              <option value="prepaid">선불</option>
              <option value="postpaid">후불</option>
            </select>
          </Field>
          {text("monthlyPrice", "월 정가 (원)", "number")}
          {text("contractStart", "시작일", "date")}
          {text("contractEnd", "종료일", "date")}
          {text("cancelNoticeDate", "해지를 알린 날", "date")}
          {text("cancelDate", "해지 예정일", "date")}
        </>
      )}
      <div className="col-span-2 flex justify-end">
        <Button variant="primary" type="button" onClick={() => onSave(v)}>저장하기</Button>
      </div>
    </Card>
  );
}

function Memos({ id }: { id: string }) {
  const qc = useQueryClient();
  const showToast = useToast();
  const [body, setBody] = useState("");
  const q = useQuery({ queryKey: ["client-memos", id], queryFn: () => clientsApi<{ items: ClientMemo[] }>(`/${id}/memos`).then((d) => d.items) });

  const add = async () => {
    try {
      await clientsApi(`/${id}/memos`, "POST", { body });
      setBody("");
      await qc.invalidateQueries({ queryKey: ["client-memos", id] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "메모를 남기지 못했어요.");
    }
  };

  return (
    <Card className="p-5 flex flex-col gap-3">
      <p className="m-0 font-medium text-[13px] text-[var(--w-fg-neutral)]">메모는 고칠 수 없어요. 틀린 내용은 새 메모로 바로잡아 주세요.</p>
      {(q.data ?? []).map((m) => (
        <div key={m.id} className="border-b border-[var(--w-line-normal)] pb-2">
          <div className="font-medium text-[12px] text-[var(--w-fg-neutral)]">{m.author} · {new Date(m.createdAt).toLocaleString("ko-KR")}</div>
          <div className="font-medium text-[14px] text-[var(--w-fg-strong)] whitespace-pre-wrap">{m.body}</div>
        </div>
      ))}
      <label htmlFor="memo" className="font-semibold text-[13px] text-[var(--w-fg-strong)]">새 메모</label>
      <textarea id="memo" rows={3} value={body} onChange={(e) => setBody(e.target.value)} className={INPUT} />
      <div className="flex justify-end"><Button variant="primary" type="button" disabled={!body.trim()} onClick={add}>남기기</Button></div>
    </Card>
  );
}

function Bills({ id, c }: { id: string; c: Client }) {
  const qc = useQueryClient();
  const showToast = useToast();
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const q = useQuery({ queryKey: ["client-bills", id], queryFn: () => clientsApi<{ items: ClientBill[] }>(`/${id}/bills`).then((d) => d.items) });
  const bills = q.data ?? [];

  const save = async (b: ClientBill, ok: string) => {
    try {
      await clientsApi(`/${id}/bills`, "PUT", b);
      showToast(ok);
      await qc.invalidateQueries({ queryKey: ["client-bills", id] });
      await qc.invalidateQueries({ queryKey: ["client", id] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "청구를 저장하지 못했어요.");
    }
  };

  const calc = async () => {
    try {
      setSettlement(await clientsApi<Settlement>(`/${id}/settlement?noticeDate=${c.cancelNoticeDate}&endDate=${c.cancelDate}`));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "마지막 청구를 계산하지 못했어요.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Card className="p-5 flex flex-col gap-2">
        {bills.length === 0 && <span className="font-medium text-[13px] text-[var(--w-fg-neutral)]">아직 청구 기록이 없어요.</span>}
        {bills.map((b) => (
          <div key={b.id} className="flex items-center gap-4 border-b border-[var(--w-line-normal)] pb-2 font-medium text-[13px]">
            <span className="font-semibold w-16">{b.contractMonth}개월째</span>
            <span className="w-28">{won(b.amount)}{b.discount ? ` (할인 ${won(b.discount)})` : ""}</span>
            <span>기한 {b.dueDate ?? "—"}</span>
            <span>{b.paidDate ? `입금 ${b.paidDate}` : ""}</span>
            {!b.paidDate && b.dueDate && b.dueDate < today && <Chip variant="neg">늦음</Chip>}
            {!b.paidDate && <Button className="ml-auto" variant="secondary" type="button" onClick={() => save({ ...b, paidDate: today }, "입금을 확인했어요")}>입금 확인하기</Button>}
          </div>
        ))}
        <div className="flex justify-end">
          <Button variant="primary" type="button" onClick={() => save({ contractMonth: bills.length + 1, amount: c.monthlyPrice }, "청구를 추가했어요")}>
            다음 달 청구 추가하기
          </Button>
        </div>
      </Card>
      {c.cancelNoticeDate && c.cancelDate && (
        <Card className="p-5 flex flex-col gap-2">
          <Button variant="secondary" type="button" onClick={calc}>마지막 청구 계산하기</Button>
          {settlement && (
            <p className="m-0 font-medium text-[14px] text-[var(--w-fg-strong)]">
              {settlement.lastContractMonth}개월째({settlement.effectiveEnd}까지) 청구해요.
              {settlement.clawback > 0 ? ` 3개월을 채우지 않아 첫 달 할인분 ${won(settlement.clawback)}을 마지막 청구에 더해요.` : " 첫 달 할인분은 돌려받지 않아요."}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
