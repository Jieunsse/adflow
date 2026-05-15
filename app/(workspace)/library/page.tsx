"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon, { type IconName } from "@shared/ui/Icon";
import { EmptyState } from "@shared/ui/primitives";
import { fmt, timeAgo } from "@shared/lib/format";
import { useLibrary, type LibraryItem } from "@shared/lib/library";
import { useToast } from "@shared/ui/Toast";

type SortKey = "recent" | "oldest" | "az";
type View = "grid" | "list";

const TONE_LABEL: Record<string, string> = { warm: "감성적", pro: "전문적", trendy: "트렌디", emotional: "감성적", professional: "전문적" };

export default function LibraryPage() {
  const router = useRouter();
  const showToast = useToast();
  const { list, remove } = useLibrary();
  const [query, setQuery] = useState("");
  const [toneFilter, setToneFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<View>("grid");
  const [previewId, setPreviewId] = useState<string | null>(null);

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
      sessionStorage.setItem("adflow_goal", item.goal ?? "");
      sessionStorage.setItem("adflow_loaded_creative", JSON.stringify({ headline: item.headline, primary: item.primary, ctaId: item.ctaId, tone: item.tone }));
    } catch {
      /* sessionStorage 사용 불가 — 입력값 없이 이동 */
    }
    setPreviewId(null);
    router.push("/create");
  };

  const onDelete = (id: string) => { remove(id); showToast("소재가 삭제되었어요"); };

  return (
    <div className="page" data-screen-label="소재 라이브러리">
      <div className="page__head">
        <div>
          <span className="w-overline" style={{ color: "var(--w-fg-neutral)" }}>캠페인 관리</span>
          <h1 className="page__title" style={{ marginTop: 4 }}>소재 라이브러리</h1>
          <p className="page__sub">AI로 생성하고 저장한 광고 소재를 한 곳에서 살펴보고 다시 활용하세요.</p>
        </div>
        <div style={{ display: "inline-flex", gap: 8 }}>
          <button className="btn btn--primary" type="button" onClick={goCreate}><Icon name="sparkles" size={14} /> 새 소재 만들기</button>
        </div>
      </div>

      <div className="card" style={{ padding: 14, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 18 }}>
        <div style={{ position: "relative", flex: "1 1 280px", minWidth: 220 }}>
          <Icon name="message" size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--w-fg-alternative)" }} />
          <input className="input" placeholder="브랜드·헤드라인·본문에서 검색" value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <div className="seg" style={{ flex: "0 0 auto" }}>
          <button type="button" className={toneFilter === "all" ? "on" : ""} onClick={() => setToneFilter("all")}>전체</button>
          {tones.map((t) => (
            <button key={t} type="button" className={toneFilter === t ? "on" : ""} onClick={() => setToneFilter(t)}>{TONE_LABEL[t] ?? t}</button>
          ))}
        </div>
        <select className="select" style={{ flex: "0 0 auto", width: 150 }} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="recent">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="az">헤드라인 가나다</option>
        </select>
        <div className="seg" style={{ flex: "0 0 auto", marginLeft: "auto" }}>
          <button type="button" className={view === "grid" ? "on" : ""} onClick={() => setView("grid")} title="그리드 보기"><Icon name="grid" size={14} /></button>
          <button type="button" className={view === "list" ? "on" : ""} onClick={() => setView("list")} title="리스트 보기"><Icon name="doc" size={14} /></button>
        </div>
      </div>

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
            ? <button className="btn btn--primary" type="button" onClick={goCreate}><Icon name="sparkles" size={14} /> 광고 만들기로 이동</button>
            : <button className="btn btn--secondary" type="button" onClick={() => { setQuery(""); setToneFilter("all"); }}>필터 초기화</button>}
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
    <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: soft, color: tint, display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon name={icon} size={18} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ font: "500 11.5px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)", letterSpacing: "0.02em", marginBottom: 6 }}>{label}</div>
        <div style={{ font: "700 22px/1 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.02em" }}>{value}</div>
      </div>
    </div>
  );
}

function CreativeCard({ item, onPreview, onDelete }: { item: LibraryItem; onPreview: () => void; onDelete: () => void }) {
  return (
    <div
      className="card"
      style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer", transition: "border-color 120ms ease" }}
      onClick={onPreview}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--w-line-normal)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--w-line-alternative)"; }}
    >
      <div style={{ position: "relative", aspectRatio: "16 / 10", background: item.gradient, display: "flex", alignItems: "flex-end", padding: 16, color: "#fff" }}>
        <div style={{ position: "absolute", top: 12, left: 12, display: "inline-flex", gap: 6 }}>
          <span className="chip" style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}><Icon name="sparkles" size={12} /> {item.tag || "AI 생성"}</span>
        </div>
        <div style={{ font: "700 16px/1.35 var(--w-font-display)", letterSpacing: "-0.014em", textShadow: "0 2px 8px rgba(0,0,0,0.18)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.headline}</div>
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div style={{ font: "500 13px/1.55 var(--w-font-sans)", color: "var(--w-fg-neutral)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 40, whiteSpace: "pre-wrap" }}>{item.primary}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {item.toneLabel && <span className="chip chip--neutral">{item.toneLabel}</span>}
          {item.ctaLabel && <span className="chip chip--neutral"><Icon name="target" size={12} /> {item.ctaLabel}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2, paddingTop: 10, borderTop: "1px solid var(--w-line-alternative)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-alternative)" }}><Icon name="clock" size={12} /> {timeAgo(item.savedAt)}</span>
          <button className="btn btn--ghost btn--sm" type="button" title="삭제" style={{ color: "var(--w-fg-alternative)" }} onClick={(e) => { e.stopPropagation(); onDelete(); }}><Icon name="x" size={14} /></button>
        </div>
      </div>
    </div>
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
        <div style={{ font: "600 14.5px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.headline}</div>
        <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.brand}</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{item.toneLabel && <span className="chip chip--neutral">{item.toneLabel}</span>}</div>
      <span style={{ font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-alternative)" }}>{timeAgo(item.savedAt)}</span>
      <button className="btn btn--ghost btn--sm" type="button" title="삭제" style={{ color: "var(--w-fg-alternative)" }} onClick={(e) => { e.stopPropagation(); onDelete(); }}><Icon name="x" size={14} /></button>
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
            <span className="chip" style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}><Icon name="sparkles" size={12} /> {item.tag || "AI 생성"}</span>
            <span className="chip" style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}><Icon name="clock" size={12} /> {timeAgo(item.savedAt)}</span>
          </div>
          {item.brand && <div style={{ font: "500 13px/1 var(--w-font-sans)", opacity: 0.86, marginBottom: 8 }}>{item.brand}</div>}
          <div style={{ font: "700 26px/1.3 var(--w-font-display)", letterSpacing: "-0.018em", textShadow: "0 2px 12px rgba(0,0,0,0.18)" }}>{item.headline}</div>
        </div>
        <div style={{ padding: "26px 32px 28px", display: "flex", flexDirection: "column", gap: 22 }}>
          <DetailRow label="기본 텍스트" actions={<button className="btn btn--ghost btn--sm" type="button" onClick={() => onCopy(item.primary || "")}><Icon name="copy" size={12} /> 복사</button>}>
            <div style={{ font: "500 14px/1.7 var(--w-font-sans)", color: "var(--w-fg-strong)", whiteSpace: "pre-wrap" }}>{item.primary}</div>
          </DetailRow>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <DetailRow label="톤앤매너"><span className="chip chip--neutral">{item.toneLabel || "—"}</span></DetailRow>
            <DetailRow label="CTA"><span className="chip chip--neutral"><Icon name="target" size={12} /> {item.ctaLabel || "—"}</span></DetailRow>
            {item.goal && <DetailRow label="광고 목적"><div style={{ font: "500 13.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{item.goal}</div></DetailRow>}
            {item.target && <DetailRow label="타겟"><div style={{ font: "500 13.5px/1.55 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>{item.target}</div></DetailRow>}
          </div>
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--w-line-alternative)", background: "var(--w-bg-alternative)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn--ghost" type="button" onClick={onDelete} style={{ color: "var(--w-status-negative)" }}><Icon name="x" size={14} /> 삭제</button>
          <div style={{ display: "inline-flex", gap: 8 }}>
            <button className="btn btn--secondary" type="button" onClick={onClose}>닫기</button>
            <button className="btn btn--primary" type="button" onClick={onUse}><Icon name="megaphone" size={14} /> 이 소재로 광고 만들기</button>
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
        <span style={{ font: "600 10.5px/1 var(--w-font-sans)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--w-fg-alternative)" }}>{label}</span>
        {actions}
      </div>
      {children}
    </div>
  );
}
