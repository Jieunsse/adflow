"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Icon, { type IconName } from "@shared/ui/Icon";
import { EmptyState } from "@shared/ui/primitives";
import { fmt, timeAgo } from "@shared/lib/format";
import { useLibrary, type LibraryItem } from "@shared/lib/library";
import { useToast } from "@shared/ui/Toast";
import { getMockLibraryItems } from "@/lib/mock-library";
import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { Chip } from "@shared/ui/Chip";
import { SegControl } from "@shared/ui/SegControl";
import { cn } from "@shared/lib/cn";

type SortKey = "recent" | "oldest" | "az";
type View = "grid" | "list";

const TONE_LABEL: Record<string, string> = { warm: "감성적", pro: "전문적", trendy: "트렌디", emotional: "감성적", professional: "전문적" };

export default function LibraryPage() {
  const router = useRouter();
  const showToast = useToast();
  const { list: savedList, remove } = useLibrary();
  const { data: session } = useSession();
  const browseMode = !!session?.browseMode;
  const [query, setQuery] = useState("");
  const [toneFilter, setToneFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<View>("grid");
  const [previewId, setPreviewId] = useState<string | null>(null);
  // 둘러보기 데모 항목은 localStorage 를 오염시키지 않도록 메모리에서만 숨김 처리해요. 새로고침하면 다시 등장.
  const [hiddenMockIds, setHiddenMockIds] = useState<Set<string>>(() => new Set());

  const mockList = useMemo(
    () => (browseMode ? getMockLibraryItems().filter((x) => !hiddenMockIds.has(x.id)) : []),
    [browseMode, hiddenMockIds],
  );
  const list = useMemo(() => [...mockList, ...savedList], [mockList, savedList]);

  const tones = useMemo(() => Array.from(new Set(list.map((x) => x.tone).filter(Boolean))), [list]);

  const filtered = useMemo(() => {
    const qs = query.trim().toLowerCase();
    let out = list.filter((x) => {
      if (toneFilter !== "all" && x.tone !== toneFilter) return false;
      if (!qs) return true;
      return (x.brand || "").toLowerCase().includes(qs) || (x.headline || "").toLowerCase().includes(qs) || (x.primary || "").toLowerCase().includes(qs);
    });
    out = [...out];
    if (sort === "recent") out.sort((a, b) => b.savedAt - a.savedAt);
    else if (sort === "oldest") out.sort((a, b) => a.savedAt - b.savedAt);
    else out.sort((a, b) => (a.headline || "").localeCompare(b.headline || "", "ko"));
    return out;
  }, [list, query, toneFilter, sort]);

  const preview = previewId ? list.find((x) => x.id === previewId) ?? null : null;
  const goCreate = () => router.push("/create");

  const loadCreativeToEditor = (item: LibraryItem) => {
    try {
      sessionStorage.setItem("adflow_brand", item.brand ?? "");
      sessionStorage.setItem("adflow_target", item.target ?? "");
      // PRD §13.10 — adflow_goal sessionStorage 키 폐기. item.goal 은 LibraryItem 호환 목적만.
      sessionStorage.setItem("adflow_loaded_creative", JSON.stringify({ headline: item.headline, primary: item.primary, ctaId: item.ctaId, tone: item.tone }));
    } catch {
      /* sessionStorage 사용 불가 — 입력값 없이 이동 */
    }
    setPreviewId(null);
    router.push("/create");
  };

  const onDelete = (id: string) => {
    if (id.startsWith("cre_demo_")) {
      setHiddenMockIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      showToast("둘러보기 데모 소재는 새로고침하면 다시 보여요");
      return;
    }
    remove(id);
    showToast("소재가 삭제되었어요");
  };

  return (
    <div className="px-12 py-9 pb-16 max-w-[1280px] w-full mx-auto flex flex-col gap-7" data-screen-label="소재 라이브러리">
      <div className="flex justify-between items-end gap-6">
        <div>
          <span className="font-semibold text-[11px] leading-[1.45] tracking-[0.04em] uppercase text-[var(--w-fg-neutral)]">캠페인 관리</span>
          <h1 className="m-0 font-bold text-[28px] leading-[1.25] tracking-[-0.024em] text-[var(--w-fg-strong)]" style={{ marginTop: 4 }}>소재 라이브러리</h1>
          <p className="font-medium text-[14px] leading-[1.5] tracking-[0.004em] text-[var(--w-fg-neutral)] mt-1.5 mb-0">AI로 생성하고 저장한 광고 소재를 한 곳에서 살펴보고 다시 활용하세요.</p>
        </div>
        <div style={{ display: "inline-flex", gap: 8 }}>
          <Button variant="primary" onClick={goCreate}><Icon name="sparkles" size={14} /> 새 소재 만들기</Button>
        </div>
      </div>

      <Card style={{ padding: 14, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 18 }}>
        <div style={{ position: "relative", flex: "1 1 280px", minWidth: 220 }}>
          <Icon name="message" size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--w-fg-alternative)" }} />
          <input
            className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-3 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] tracking-[0.004em] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)]"
            placeholder="브랜드·헤드라인·본문에서 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <SegControl
            value={toneFilter}
            onChange={setToneFilter}
            options={[{ value: "all", label: "전체" }, ...tones.map((t) => ({ value: t, label: TONE_LABEL[t] ?? t }))]}
          />
        </div>
        <select
          className="w-full bg-[var(--w-bg-elevated)] border border-[var(--w-line-normal)] rounded-xl px-3.5 py-3 font-medium text-[14px] leading-[1.5] text-[var(--w-fg-strong)] tracking-[0.004em] outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-[var(--w-primary-normal)] focus:shadow-[0_0_0_4px_rgba(0,102,255,0.14)] placeholder:text-[var(--w-fg-alternative)] appearance-none"
          style={{ flex: "0 0 auto", width: 150 }}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="recent">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="az">헤드라인 가나다</option>
        </select>
        <div className="inline-flex gap-0.5 p-[3px] bg-[var(--w-bg-alternative)] rounded-[10px] ml-auto">
          <button
            type="button"
            className={cn("border-none px-3.5 py-2 rounded-lg cursor-pointer transition-[background,color] duration-[120ms]", view === "grid" ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]" : "bg-transparent text-[var(--w-fg-neutral)]")}
            onClick={() => setView("grid")}
            title="그리드 보기"
          ><Icon name="grid" size={14} /></button>
          <button
            type="button"
            className={cn("border-none px-3.5 py-2 rounded-lg cursor-pointer transition-[background,color] duration-[120ms]", view === "list" ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]" : "bg-transparent text-[var(--w-fg-neutral)]")}
            onClick={() => setView("list")}
            title="리스트 보기"
          ><Icon name="doc" size={14} /></button>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 18 }}>
        <SummaryStat label="저장된 소재" value={fmt(list.length)} icon="folder" />
        <SummaryStat label="이번 주 저장" value={fmt(list.filter((x) => Date.now() - x.savedAt < 7 * 86400000).length)} icon="sparkles" accent="violet" />
        <SummaryStat label="필터 결과" value={fmt(filtered.length)} icon="target" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Icon name="folder" size={26} />}
          title={list.length === 0 ? "아직 저장된 소재가 없어요" : "조건에 맞는 소재가 없어요"}
          desc={list.length === 0
            ? "광고 만들기에서 AI 생성 결과가 마음에 들면 '소재 라이브러리에 저장' 버튼을 눌러보세요."
            : "검색어나 필터를 바꿔서 다시 시도해 보세요."}
          action={list.length === 0
            ? <Button variant="primary" onClick={goCreate}><Icon name="sparkles" size={14} /> 광고 만들기로 이동</Button>
            : <Button variant="secondary" onClick={() => { setQuery(""); setToneFilter("all"); }}>필터 초기화</Button>}
        />
      ) : view === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filtered.map((item) => <CreativeCard key={item.id} item={item} onPreview={() => setPreviewId(item.id)} onDelete={() => onDelete(item.id)} />)}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((item) => <CreativeRow key={item.id} item={item} onPreview={() => setPreviewId(item.id)} onDelete={() => onDelete(item.id)} />)}
        </div>
      )}

      {preview && (
        <PreviewModal
          item={preview}
          onClose={() => setPreviewId(null)}
          onDelete={() => { onDelete(preview.id); setPreviewId(null); }}
          onCopy={(text) => { navigator.clipboard?.writeText(text).catch(() => {}); showToast("클립보드에 복사했어요"); }}
          onUse={() => loadCreativeToEditor(preview)}
        />
      )}
    </div>
  );
}

function SummaryStat({ label, value, icon, accent }: { label: string; value: string; icon: IconName; accent?: "violet" }) {
  const tint = accent === "violet" ? "var(--w-accent-violet)" : "var(--w-primary-press)";
  const soft = accent === "violet" ? "var(--w-accent-violet-soft)" : "var(--w-primary-soft)";
  return (
    <Card style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: soft, color: tint, display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name={icon} size={18} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "var(--w-fg-neutral)", letterSpacing: "0.02em", marginBottom: 6 }} className="font-medium text-[11.5px] leading-none">{label}</div>
        <div style={{ color: "var(--w-fg-strong)", letterSpacing: "-0.02em" }} className="font-bold text-[22px] leading-none [font-family:var(--w-font-display)]">{value}</div>
      </div>
    </Card>
  );
}

function CreativeCard({ item, onPreview, onDelete }: { item: LibraryItem; onPreview: () => void; onDelete: () => void }) {
  return (
    <Card
      style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer", transition: "border-color 120ms ease" }}
      onClick={onPreview}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--w-line-normal)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--w-line-alternative)"; }}
    >
      <div style={{ position: "relative", aspectRatio: "16 / 10", background: item.gradient, display: "flex", alignItems: "flex-end", padding: 16, color: "#fff" }}>
        <div style={{ position: "absolute", top: 12, left: 12, display: "inline-flex", gap: 6 }}>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs leading-none tracking-[0.006em] whitespace-nowrap" style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}><Icon name="sparkles" size={12} /> {item.tag || "AI 생성"}</span>
        </div>
        <div style={{ letterSpacing: "-0.014em", textShadow: "0 2px 8px rgba(0,0,0,0.18)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }} className="font-bold text-[16px] leading-[1.35] [font-family:var(--w-font-display)]">{item.headline}</div>
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 40, whiteSpace: "pre-wrap", color: "var(--w-fg-neutral)" }} className="font-medium text-[13px] leading-[1.55]">{item.primary}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {item.toneLabel && <Chip variant="neutral">{item.toneLabel}</Chip>}
          {item.ctaLabel && <Chip variant="neutral"><Icon name="target" size={12} /> {item.ctaLabel}</Chip>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2, paddingTop: 10, borderTop: "1px solid var(--w-line-alternative)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--w-fg-alternative)" }} className="font-medium text-[12px] leading-none"><Icon name="clock" size={12} /> {timeAgo(item.savedAt)}</span>
          <Button variant="ghost" size="sm" style={{ color: "var(--w-fg-alternative)" }} onClick={(e) => { e.stopPropagation(); onDelete(); }}><Icon name="x" size={14} /></Button>
        </div>
      </div>
    </Card>
  );
}

function CreativeRow({ item, onPreview, onDelete }: { item: LibraryItem; onPreview: () => void; onDelete: () => void }) {
  return (
    <button
      type="button"
      onClick={onPreview}
      style={{ display: "grid", gridTemplateColumns: "80px 1fr 180px 100px 40px", gap: 14, alignItems: "center", padding: 12, border: "1px solid var(--w-line-alternative)", borderRadius: 12, background: "var(--w-bg-elevated)", cursor: "pointer", textAlign: "left", width: "100%", transition: "border-color 120ms ease" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--w-line-normal)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--w-line-alternative)")}
    >
      <div style={{ width: 80, height: 56, borderRadius: 8, background: item.gradient, flex: "0 0 auto" }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "var(--w-fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} className="font-semibold text-[14.5px] leading-[1.4]">{item.headline}</div>
        <div style={{ marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--w-fg-neutral)" }} className="font-medium text-[12.5px] leading-[1.5]">{item.brand}</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{item.toneLabel && <Chip variant="neutral">{item.toneLabel}</Chip>}</div>
      <span style={{ color: "var(--w-fg-alternative)" }} className="font-medium text-[12px] leading-none">{timeAgo(item.savedAt)}</span>
      <Button variant="ghost" size="sm" style={{ color: "var(--w-fg-alternative)" }} onClick={(e) => { e.stopPropagation(); onDelete(); }}><Icon name="x" size={14} /></Button>
    </button>
  );
}

function PreviewModal({ item, onClose, onDelete, onCopy, onUse }: { item: LibraryItem; onClose: () => void; onDelete: () => void; onCopy: (text: string) => void; onUse: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,17,25,0.55)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(880px, 100%)", maxHeight: "calc(100vh - 48px)", overflow: "auto", background: "var(--w-bg-elevated)", borderRadius: 18, border: "1px solid var(--w-line-alternative)", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
        <div style={{ position: "relative", padding: "28px 32px 36px", background: item.gradient, color: "#fff" }}>
          <button type="button" onClick={onClose} title="닫기" style={{ position: "absolute", top: 14, right: 14, width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.18)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name="x" size={16} /></button>
          <div style={{ display: "inline-flex", gap: 6, marginBottom: 14 }}>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs leading-none tracking-[0.006em] whitespace-nowrap" style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}><Icon name="sparkles" size={12} /> {item.tag || "AI 생성"}</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs leading-none tracking-[0.006em] whitespace-nowrap" style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}><Icon name="clock" size={12} /> {timeAgo(item.savedAt)}</span>
          </div>
          {item.brand && <div style={{ opacity: 0.86, marginBottom: 8 }} className="font-medium text-[13px] leading-none">{item.brand}</div>}
          <div style={{ letterSpacing: "-0.018em", textShadow: "0 2px 12px rgba(0,0,0,0.18)" }} className="font-bold text-[26px] leading-[1.3] [font-family:var(--w-font-display)]">{item.headline}</div>
        </div>
        <div style={{ padding: "26px 32px 28px", display: "flex", flexDirection: "column", gap: 22 }}>
          <DetailRow label="기본 텍스트" actions={<Button variant="ghost" size="sm" onClick={() => onCopy(item.primary || "")}><Icon name="copy" size={12} /> 복사</Button>}>
            <div style={{ whiteSpace: "pre-wrap", color: "var(--w-fg-strong)" }} className="font-medium text-[14px] leading-[1.7]">{item.primary}</div>
          </DetailRow>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <DetailRow label="톤앤매너"><Chip variant="neutral">{item.toneLabel || "—"}</Chip></DetailRow>
            <DetailRow label="CTA"><Chip variant="neutral"><Icon name="target" size={12} /> {item.ctaLabel || "—"}</Chip></DetailRow>
            {item.goal && <DetailRow label="광고 목적"><div style={{ color: "var(--w-fg-strong)" }} className="font-medium text-[13.5px] leading-[1.55]">{item.goal}</div></DetailRow>}
            {item.target && <DetailRow label="타겟"><div style={{ color: "var(--w-fg-strong)" }} className="font-medium text-[13.5px] leading-[1.55]">{item.target}</div></DetailRow>}
          </div>
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--w-line-alternative)", background: "var(--w-bg-alternative)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Button variant="ghost" onClick={onDelete} style={{ color: "var(--w-status-negative)" }}><Icon name="x" size={14} /> 삭제</Button>
          <div style={{ display: "inline-flex", gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>닫기</Button>
            <Button variant="primary" onClick={onUse}><Icon name="megaphone" size={14} /> 이 소재로 광고 만들기</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, actions, children }: { label: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--w-fg-alternative)" }} className="font-semibold text-[10.5px] leading-none">{label}</span>
        {actions}
      </div>
      {children}
    </div>
  );
}
