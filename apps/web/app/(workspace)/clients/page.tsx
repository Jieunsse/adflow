"use client";

// 고객사 관리 (기능명세 14-1). 영업 단계별 칸에 고객사 카드를 보여 준다.
// shortcut: 카드를 끌어 단계를 바꾸는 대신 상세 화면에서 단계를 고른다. 표 보기도 아직 없다.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import { Skeleton } from "@shared/ui/Skeleton";
import { useToast } from "@shared/ui/Toast";
import { INQUIRY_SOURCES, STAGES, clientsApi, type Client, type ClientView } from "@entities/client/model";

export default function ClientsPage() {
  const router = useRouter();
  const showToast = useToast();
  const { data: session } = useSession();
  const isLead = session?.role === "팀장";
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [source, setSource] = useState("meta_ad");
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const q = useQuery({
    queryKey: ["clients"],
    queryFn: () => clientsApi<{ items: ClientView[] }>("").then((d) => d.items),
    enabled: !!session && !session.browseMode,
  });
  const items = q.data ?? [];

  const add = async () => {
    try {
      const c = await clientsApi<Client>("", "POST", { name: name.trim(), inquirySource: source });
      router.push(`/clients/${c.id}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "고객사를 추가하지 못했어요.");
    }
  };

  return (
    <div className="px-12 py-9 pb-16 w-full mx-auto flex flex-col gap-6" data-screen-label="고객사 관리">
      <div className="flex justify-between items-end gap-6">
        <div>
          <h1 className="m-0 font-bold text-[28px] leading-[1.25] text-[var(--w-fg-strong)]">고객사 관리</h1>
          <p className="font-medium text-[14px] leading-[1.5] text-[var(--w-fg-neutral)] mt-1.5 mb-0">
            문의부터 재계약까지 고객사를 한곳에서 관리해요.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/clients/time"><Button variant="secondary" type="button">작업 시간</Button></Link>
          <Button variant="primary" type="button" onClick={() => setAdding(true)}>고객사 추가하기</Button>
        </div>
      </div>

      {adding && (
        <Card className="p-5 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 font-semibold text-[13px] text-[var(--w-fg-strong)]">
            회사 이름
            <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-[var(--w-line-normal)] p-2.5 text-[14px] font-medium" />
          </label>
          <label className="flex flex-col gap-1 font-semibold text-[13px] text-[var(--w-fg-strong)]">
            문의 경로
            <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded-lg border border-[var(--w-line-normal)] p-2.5 text-[14px] font-medium">
              {INQUIRY_SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <Button variant="secondary" type="button" onClick={() => setAdding(false)}>취소</Button>
          <Button variant="primary" type="button" disabled={!name.trim()} onClick={add}>추가하기</Button>
        </Card>
      )}

      {session?.browseMode ? (
        <Card className="py-8 px-6 font-medium text-[13px] text-[var(--w-fg-neutral)]">둘러보기에서는 고객사 기록을 저장하지 않아요.</Card>
      ) : q.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : q.isError ? (
        <Card className="py-8 px-6 font-medium text-[13px] text-[var(--w-fg-neutral)]">고객사를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</Card>
      ) : (
        <div className="grid grid-cols-6 gap-3 min-w-[1100px]">
          {STAGES.map((st) => {
            const col = items.filter((v) => v.client.stage === st.key);
            return (
              <div key={st.key} className="flex flex-col gap-2">
                <div className="font-bold text-[13px] text-[var(--w-fg-strong)]">{st.label} {col.length}</div>
                {col.map(({ client: c, overdue }) => {
                  const late = !!c.nextActionDate && c.nextActionDate < today;
                  return (
                    <Link key={c.id} href={`/clients/${c.id}`}>
                      <Card className="p-3 flex flex-col gap-1 hover:bg-[var(--w-bg-alternative)]">
                        <span className="font-semibold text-[14px] text-[var(--w-fg-strong)]">{c.name}</span>
                        <span className="font-medium text-[12px] text-[var(--w-fg-neutral)]">
                          {[c.industry, INQUIRY_SOURCES.find((s) => s.key === c.inquirySource)?.label].filter(Boolean).join(" · ") || "업종 미입력"}
                        </span>
                        {c.nextAction && (
                          <span className={`font-medium text-[12px] ${late ? "text-[var(--w-status-negative)]" : "text-[var(--w-fg-neutral)]"}`}>
                            {c.nextAction}{c.nextActionDate ? ` · ${c.nextActionDate}` : ""}
                          </span>
                        )}
                        {/* 연체 표시는 팀장에게만 보인다 (기능명세 14-1). */}
                        {isLead && overdue && <Chip variant="neg">입금 늦음</Chip>}
                      </Card>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
