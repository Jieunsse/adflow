"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Icon from "@shared/ui/Icon";

import { Button } from "@shared/ui/Button";
import { Card } from "@shared/ui/Card";
import { useToast } from "@shared/ui/Toast";
import { IgPostPreview } from "@shared/ui/IgPostPreview";
import { readProfiles, readActiveBrandProfileEntry } from "@features/brand-profile/model/useBrandProfileStorage";
import type { BrandProfileEntry } from "@features/brand-profile/model/useBrandProfileStorage";
import { readPersonas } from "@features/brand-profile/model/usePersonasStorage";
import type { PersonaEntry } from "@features/brand-profile/model/usePersonasStorage";
import { sectionPreviewText, isSectionFilled } from "@features/sop/model/useSopStorage";
import { SOP_SECTION_LABEL } from "@features/sop/model/section-labels";

type RecentItem = {
  id: string;
  mediaUrl: string;
  caption: string;
  permalink?: string;
  timestamp: string;
  likeCount?: number;
};

type PublishOk = { ok: true; postId: string; permalink?: string };
type PublishFail = { ok: false; error: string; status?: number };
type PublishResp = PublishOk | PublishFail;

type RecentResp =
  | { ok: true; items: RecentItem[] }
  | { ok: false; error: string };

type UploadResp = { ok: true; url: string } | { ok: false; error: string };

function isHttpUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim());
}


function PostsFlow() {
  const router = useRouter();
  const showToast = useToast();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const captionPrefill = searchParams.get("caption") ?? "";
  const handle = session?.igUsername ?? "instagram";
  const [igPicture, setIgPicture] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState(captionPrefill);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<PublishResp | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [recentErr, setRecentErr] = useState<string | null>(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImages, setAiImages] = useState<string[]>([]);
  const [aiPicking, setAiPicking] = useState<string | null>(null);
  const [captionSuggesting, setCaptionSuggesting] = useState(false);
  const [imageTab, setImageTab] = useState<"upload" | "ai">("upload");
  const [captionTab, setCaptionTab] = useState<"write" | "ai">("write");
  const [captionHint, setCaptionHint] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [brandProfiles, setBrandProfiles] = useState<BrandProfileEntry[]>([]);
  const [allPersonas, setAllPersonas] = useState<PersonaEntry[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      const res = await fetch("/api/instagram/recent-media", { cache: "no-store" });
      const data = (await res.json()) as RecentResp;
      if (data.ok) {
        setRecent(data.items);
        setRecentErr(null);
      } else {
        setRecent([]);
        setRecentErr(data.error);
      }
    } catch (e) {
      setRecentErr(e instanceof Error ? e.message : "최근 게시 조회 실패");
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    fetch("/api/connect/profile-pictures")
      .then(r => r.ok ? r.json() : null)
      .then((data: { igPicture?: string | null } | null) => { if (data?.igPicture) setIgPicture(data.igPicture); })
      .catch(() => null);
  }, []);

  useEffect(() => {
    const profiles = readProfiles();
    const personas = readPersonas();
    setBrandProfiles(profiles);
    setAllPersonas(personas);
    const active = readActiveBrandProfileEntry();
    if (active) {
      setSelectedProfileId(active.id);
      const first = personas.find((p) => p.brandProfileId === active.id);
      if (first) setSelectedPersonaId(first.id);
    }
  }, []);

  useEffect(() => {
    setPreviewBroken(false);
  }, [imageUrl]);

  const canSubmit = imageUrl.trim().length > 0 && !submitting && !uploading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/instagram/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: imageUrl.trim(), caption: caption.trim() }),
      });
      const data = (await res.json()) as PublishResp;
      setLastResult(data);
      if (data.ok) {
        showToast("Instagram 게시 완료");
        setImageUrl("");
        setCaption("");
        await loadRecent();
        if (data.postId) setSelectedPostId(data.postId);
      } else {
        showToast(`게시 실패 — ${data.error}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "요청 실패";
      setLastResult({ ok: false, error: msg });
      showToast(`게시 실패 — ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("이미지 파일만 선택할 수 있어요");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/instagram/upload", { method: "POST", body: fd });
      const data = (await res.json()) as UploadResp;
      if (data.ok) {
        setImageUrl(data.url);
      } else {
        showToast(`업로드 실패 — ${data.error}`);
      }
    } catch (e) {
      showToast(`업로드 실패 — ${e instanceof Error ? e.message : "요청 실패"}`);
    } finally {
      setUploading(false);
    }
  }, [showToast]);

  const openFilePicker = () => {
    if (submitting || uploading) return;
    fileInputRef.current?.click();
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
      return;
    }
    const raw = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    const candidate = raw.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#")) ?? "";
    if (isHttpUrl(candidate)) {
      setImageUrl(candidate);
    } else {
      showToast("이미지 URL 을 인식하지 못했어요");
    }
  };

  const generateAi = useCallback(async () => {
    const prompt = aiPrompt.trim();
    if (!prompt || aiGenerating) return;
    setAiGenerating(true);
    setAiImages([]);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, count: 4 }),
      });
      const data = (await res.json()) as { images?: string[]; error?: string };
      if (Array.isArray(data.images) && data.images.length > 0) {
        setAiImages(data.images);
      } else {
        showToast(`이미지 생성 실패 — ${data.error ?? "결과 없음"}`);
      }
    } catch (e) {
      showToast(`이미지 생성 실패 — ${e instanceof Error ? e.message : "요청 실패"}`);
    } finally {
      setAiGenerating(false);
    }
  }, [aiPrompt, aiGenerating, showToast]);

  const pickAiImage = useCallback(async (dataUrl: string) => {
    if (aiPicking) return;
    setAiPicking(dataUrl);
    setUploading(true);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const mime = blob.type || "image/png";
      const ext = mime.split("/")[1] ?? "png";
      const file = new File([blob], `ai-${Date.now()}.${ext}`, { type: mime });
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/instagram/upload", { method: "POST", body: fd });
      const data = (await res.json()) as UploadResp;
      if (data.ok) setImageUrl(data.url);
      else showToast(`업로드 실패 — ${data.error}`);
    } catch (e) {
      showToast(`업로드 실패 — ${e instanceof Error ? e.message : "요청 실패"}`);
    } finally {
      setUploading(false);
      setAiPicking(null);
    }
  }, [aiPicking, showToast]);

  const selectedProfile = brandProfiles.find((p) => p.id === selectedProfileId) ?? null;
  const profilePersonas = allPersonas.filter((p) => p.brandProfileId === selectedProfileId);
  const selectedPersona = profilePersonas.find((p) => p.id === selectedPersonaId) ?? null;

  const suggestCaption = useCallback(async () => {
    setCaptionSuggesting(true);
    try {
      const profile = brandProfiles.find((p) => p.id === selectedProfileId) ?? null;
      const persona = allPersonas.find((p) => p.id === selectedPersonaId) ?? null;
      const brandContext = profile
        ? {
            tone: profile.tone,
            brandVoice: profile.brandVoice,
            customerVoiceSummary: profile.customerVoiceSummary,
            imageGuide: profile.imageGuide,
            personaDescription: persona?.customerDescription,
          }
        : undefined;

      const res = await fetch("/api/instagram/posts/suggest-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "caption", hint: captionHint.trim(), brandContext }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (data.text) {
        setCaption(data.text);
        setCaptionTab("write");
      } else {
        showToast(`AI 생성 실패 — ${data.error ?? "결과 없음"}`);
      }
    } catch (e) {
      showToast(`AI 생성 실패 — ${e instanceof Error ? e.message : "요청 실패"}`);
    } finally {
      setCaptionSuggesting(false);
    }
  }, [captionHint, showToast, brandProfiles, allPersonas, selectedProfileId, selectedPersonaId]);

  const onPasteZone = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").trim();
    if (isHttpUrl(text)) {
      e.preventDefault();
      setImageUrl(text);
    }
  };

  return (
    <>
      <p className="text-[14px] leading-[1.55] text-[var(--w-fg-neutral)] mb-6">
        Instagram 비즈니스 계정에 사진과 캡션을 게시해요. 오른쪽 미리보기는 실제 피드와 같은 모양으로 보여줍니다.
      </p>

      {/* AI 컨텍스트 — 별도 섹션 */}
      {brandProfiles.length > 0 && (
        <div className="mb-4 rounded-xl border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] p-3 flex flex-col gap-3">
          <div className="flex items-center gap-1.5">
            <Icon name="sparkles" size={12} />
            <span className="text-[11px] font-semibold text-[var(--w-fg-neutral)] uppercase tracking-wide">AI 컨텍스트</span>
          </div>

          {/* 브랜드 프로필 선택 */}
          <div className="flex flex-col gap-1.5">
            <div className="text-[11px] font-semibold text-[var(--w-fg-alternative)] uppercase tracking-wide">브랜드 프로필</div>
            <div className="flex gap-1.5 flex-wrap">
              {brandProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedProfileId(p.id);
                    const first = allPersonas.find((pe) => pe.brandProfileId === p.id);
                    setSelectedPersonaId(first?.id ?? null);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[12px] font-semibold border transition-colors ${
                    selectedProfileId === p.id
                      ? "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]"
                      : "border-[var(--w-line-normal)] text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)]"
                  }`}
                >
                  {p.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setSelectedProfileId(null); setSelectedPersonaId(null); }}
                className={`px-2.5 py-1 rounded-full text-[12px] font-semibold border transition-colors ${
                  selectedProfileId === null
                    ? "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]"
                    : "border-[var(--w-line-normal)] text-[var(--w-fg-neutral)] hover:bg-[var(--w-bg-neutral)]"
                }`}
              >
                미적용
              </button>
            </div>
          </div>

          {/* 페르소나 선택 */}
          {selectedProfileId && profilePersonas.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="text-[11px] font-semibold text-[var(--w-fg-alternative)] uppercase tracking-wide">페르소나</div>
              <div className="flex gap-1.5 flex-wrap">
                {profilePersonas.map((pe) => (
                  <button
                    key={pe.id}
                    type="button"
                    onClick={() => setSelectedPersonaId(pe.id)}
                    className={`px-2.5 py-1 rounded-full text-[12px] font-semibold border transition-colors ${
                      selectedPersonaId === pe.id
                        ? "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]"
                        : "border-[var(--w-line-normal)] text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)]"
                    }`}
                  >
                    {pe.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedPersonaId(null)}
                  className={`px-2.5 py-1 rounded-full text-[12px] font-semibold border transition-colors ${
                    selectedPersonaId === null
                      ? "bg-[var(--w-fg-strong)] text-[var(--w-bg-elevated)] border-[var(--w-fg-strong)]"
                      : "border-[var(--w-line-normal)] text-[var(--w-fg-neutral)] hover:bg-[var(--w-bg-neutral)]"
                  }`}
                >
                  없음
                </button>
              </div>
            </div>
          )}

          {/* 스타일 + 정책 미리보기 */}
          {selectedProfile && (
            <div className="border-t border-[var(--w-line-alternative)] pt-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
              {selectedProfile.tone && (
                <div className="flex gap-1.5 text-[11px]">
                  <span className="text-[var(--w-fg-alternative)] flex-shrink-0">톤</span>
                  <span className="text-[#121212] line-clamp-1">{selectedProfile.tone}</span>
                </div>
              )}
              {selectedProfile.brandVoice && (
                <div className="flex gap-1.5 text-[11px]">
                  <span className="text-[var(--w-fg-alternative)] flex-shrink-0">보이스</span>
                  <span className="text-[#121212] line-clamp-1">{selectedProfile.brandVoice}</span>
                </div>
              )}
              {selectedPersona?.customerDescription && (
                <div className="flex gap-1.5 text-[11px]">
                  <span className="text-[var(--w-fg-alternative)] flex-shrink-0">타겟</span>
                  <span className="text-[#121212] line-clamp-1">{selectedPersona.customerDescription}</span>
                </div>
              )}
              {selectedProfile.imageGuide && (
                <div className="flex gap-1.5 text-[11px]">
                  <span className="text-[var(--w-fg-alternative)] flex-shrink-0">이미지</span>
                  <span className="text-[#121212] line-clamp-1">{selectedProfile.imageGuide}</span>
                </div>
              )}
              {selectedProfile.policy?.filter(isSectionFilled).map((sec) => (
                <div key={sec.type} className="flex gap-1.5 text-[11px]">
                  <span className="text-[var(--w-fg-alternative)] flex-shrink-0">{SOP_SECTION_LABEL[sec.type]}</span>
                  <span className="text-[#121212] line-clamp-1">{sectionPreviewText(sec)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Card variant="lg">
        <form id="ig-publish" onSubmit={onSubmit} className="grid grid-cols-[1fr_360px] gap-8 items-start">
          <div className="flex flex-col gap-5 min-w-0">
            {/* 이미지 — 업로드 / AI 생성 탭 */}
            <div className="flex flex-col gap-3">
              <div className="flex gap-0.5 p-0.5 rounded-[10px] bg-[var(--w-bg-neutral)] self-start">
                {(["upload", "ai"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setImageTab(tab)}
                    className={`px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold transition-colors ${
                      imageTab === tab
                        ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                        : "text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]"
                    }`}
                  >
                    {tab === "upload" ? "업로드" : "AI 생성"}
                  </button>
                ))}
              </div>

              {imageTab === "upload" ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onPaste={onPasteZone}
                  onClick={openFilePicker}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFilePicker(); } }}
                  role="button"
                  aria-label="이미지 파일 선택"
                  tabIndex={0}
                  className={`relative rounded-[14px] border-2 border-dashed outline-none transition-colors cursor-pointer ${
                    dragOver
                      ? "border-[var(--w-primary-normal)] bg-[var(--w-primary-pale,rgba(99,93,255,0.06))]"
                      : "border-[var(--w-line-normal)] bg-[var(--w-bg-base)] hover:border-[var(--w-line-strong)] focus:border-[var(--w-primary-normal)]"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onFileInputChange}
                    className="hidden"
                  />
                  {imageUrl ? (
                    <div className="flex items-start gap-4 p-4">
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-[var(--w-bg-neutral)] shrink-0">
                        {!previewBroken ? (
                          <Image
                            src={imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized
                            onError={() => setPreviewBroken(true)}
                          />
                        ) : (
                          <div className="absolute inset-0 grid place-items-center text-[var(--w-fg-alternative)]">
                            <Icon name="warn" size={20} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-[var(--w-fg-strong)] mb-1">
                          이미지 선택됨
                          {previewBroken && (
                            <span className="ml-2 text-[11px] font-normal text-[var(--w-status-negative)]">미리보기 로드 실패 — URL 을 확인해 주세요</span>
                          )}
                        </div>
                        <div className="text-[12px] text-[var(--w-fg-alternative)] break-all line-clamp-2">{imageUrl}</div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setImageUrl(""); }}
                          className="mt-2 text-[12px] font-semibold text-[var(--w-fg-neutral)] hover:text-[var(--w-status-negative)]"
                          disabled={submitting}
                        >
                          제거
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid place-items-center text-center py-10 px-4">
                      <Icon name="image" size={28} />
                      <div className="text-[14px] font-semibold text-[var(--w-fg-strong)] mt-2">
                        {uploading ? "업로드 중..." : "클릭해서 파일을 고르거나 이미지 URL 을 드래그/붙여넣기"}
                      </div>
                      <div className="text-[12px] text-[var(--w-fg-alternative)] mt-1 leading-[1.5] max-w-[360px]">
                        JPG · PNG · WebP, 최대 8MB. 업로드한 파일은 공개 URL 로 호스팅돼 Instagram 이 가져갑니다.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 items-start">
                    <textarea
                      id="aiPrompt"
                      placeholder="어떤 이미지를 만들고 싶나요? (선택) — 브랜드 프로필 기반으로 생성돼요"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={2}
                      maxLength={500}
                      className="flex-1 px-3.5 py-2.5 rounded-[10px] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[13px] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] focus-visible:outline-none resize-none leading-[1.5]"
                      disabled={aiGenerating || submitting}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generateAi(); }
                      }}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={generateAi}
                      disabled={aiGenerating || submitting}
                    >
                      {aiGenerating ? "생성 중..." : "생성"}
                    </Button>
                  </div>
                  {(aiGenerating || aiImages.length > 0) && (
                    <div className="grid grid-cols-4 gap-2">
                      {(aiGenerating ? Array.from({ length: 4 }) : aiImages).map((url, i) => {
                        const dataUrl = typeof url === "string" ? url : null;
                        const selected = !!dataUrl && imageUrl === dataUrl;
                        const picking = !!dataUrl && aiPicking === dataUrl;
                        return (
                          <button
                            type="button"
                            key={dataUrl ?? `skeleton-${i}`}
                            onClick={() => dataUrl && pickAiImage(dataUrl)}
                            disabled={!dataUrl || !!aiPicking}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${
                              selected
                                ? "border-[var(--w-primary-normal)]"
                                : "border-transparent hover:border-[var(--w-line-normal)]"
                            } ${!dataUrl ? "bg-[var(--w-bg-neutral)] animate-pulse cursor-default" : ""}`}
                            aria-pressed={selected}
                            aria-label="생성된 이미지 선택"
                          >
                            {dataUrl && (
                              <Image src={dataUrl} alt="" fill className="object-cover" unoptimized sizes="80px" />
                            )}
                            {picking && (
                              <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
                                <Icon name="clock" size={14} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 캡션 */}
            <div className="flex flex-col gap-3">
              <div className="flex gap-0.5 p-0.5 rounded-[10px] bg-[var(--w-bg-neutral)] self-start">
                {(["write", "ai"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setCaptionTab(tab)}
                    className={`px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold transition-colors ${
                      captionTab === tab
                        ? "bg-[var(--w-bg-elevated)] text-[var(--w-fg-strong)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                        : "text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)]"
                    }`}
                  >
                    {tab === "write" ? "직접 입력" : "AI 작성"}
                  </button>
                ))}
              </div>

              {captionTab === "write" ? (
                <div className="flex flex-col gap-1.5">
                  <textarea
                    id="caption"
                    placeholder="게시글 본문, 해시태그(#), @멘션을 자유롭게 적어 주세요"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={6}
                    maxLength={2200}
                    className="px-3.5 py-3 rounded-[10px] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[14px] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] focus-visible:outline-none resize-y leading-[1.55]"
                    disabled={submitting}
                  />
                  <div className="text-[12px] text-[var(--w-fg-alternative)] text-right">{caption.length} / 2200</div>
                </div>
              ) : (
                <div className="flex gap-2 items-start">
                  <textarea
                    placeholder="어떤 내용을 담고 싶나요? (선택) — 브랜드 프로필 기반으로 생성돼요"
                    value={captionHint}
                    onChange={(e) => setCaptionHint(e.target.value)}
                    rows={2}
                    maxLength={500}
                    className="flex-1 px-3.5 py-2.5 rounded-[10px] border border-[var(--w-line-normal)] bg-[var(--w-bg-elevated)] text-[13px] text-[var(--w-fg-strong)] outline-none focus:border-[var(--w-primary-normal)] focus-visible:outline-none resize-none leading-[1.5]"
                    disabled={captionSuggesting || submitting}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); suggestCaption(); }
                    }}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={suggestCaption}
                    disabled={captionSuggesting || submitting}
                  >
                    {captionSuggesting ? "생성 중..." : "생성"}
                  </Button>
                </div>
              )}
              <Button form="ig-publish" type="submit" variant="primary" size="md" disabled={!canSubmit} className="w-48 self-center mt-1">
                {submitting ? "게시 중..." : "게시하기"}
              </Button>
            </div>

            {lastResult?.ok && lastResult.permalink && (
              <a
                href={lastResult.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-semibold text-[var(--w-primary-normal)] hover:underline"
              >
                방금 게시한 글 보기 →
              </a>
            )}
            {lastResult && !lastResult.ok && (
              <div className="rounded-lg border border-[var(--w-status-negative)] bg-[rgba(232,72,72,0.06)] px-3.5 py-3 text-[13px] text-[var(--w-status-negative)] leading-[1.5]">
                <span className="font-semibold">게시 실패 — </span>
                {lastResult.error}
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] font-semibold tracking-wide uppercase text-[var(--w-fg-alternative)] mb-2">
              미리보기
            </div>
            <IgPostPreview
              imageUrl={imageUrl}
              caption={caption}
              handle={handle}
              profilePicture={igPicture}
              broken={previewBroken}
              className="w-full"
            />
          </div>
        </form>
      </Card>

      <Card variant="default" className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[14px] text-[var(--w-fg-strong)]">최근 게시</h2>
          <button
            type="button"
            onClick={loadRecent}
            className="text-[12px] font-semibold text-[var(--w-fg-neutral)] hover:text-[var(--w-fg-strong)] inline-flex items-center gap-1"
            disabled={recentLoading}
          >
            <Icon name="refresh" size={11} />
            새로고침
          </button>
        </div>
        {recentLoading ? (
          <div className="text-[13px] text-[var(--w-fg-alternative)] py-8 text-center">불러오는 중…</div>
        ) : recentErr ? (
          <div className="text-[13px] text-[var(--w-fg-alternative)] py-8 text-center leading-[1.55]">{recentErr}</div>
        ) : recent.length === 0 ? (
          <div className="text-[13px] text-[var(--w-fg-alternative)] py-8 text-center">아직 게시물이 없어요.</div>
        ) : (
          <div className="flex gap-6 items-start">
            <ul className="flex-1 min-w-0 flex flex-col gap-y-1">
              {recent.map((item) => {
                const isSelected = selectedPostId === item.id;
                return (
                  <li
                    key={item.id}
                    className={`flex flex-col rounded-lg px-2 py-2 cursor-pointer transition-colors ${isSelected ? "bg-[var(--w-bg-neutral)]" : "hover:bg-[var(--w-bg-base)]"}`}
                    onClick={() => setSelectedPostId((prev) => prev === item.id ? null : item.id)}
                  >
                    <div className="flex gap-3 items-start">
                      {item.mediaUrl ? (
                        <Image
                          src={item.mediaUrl}
                          alt=""
                          width={56}
                          height={56}
                          className="w-14 h-14 rounded-lg object-cover bg-[var(--w-bg-neutral)] shrink-0"
                          unoptimized
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-[var(--w-bg-neutral)] shrink-0 grid place-items-center">
                          <Icon name="image" size={18} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-[var(--w-fg-strong)] leading-[1.4] line-clamp-2">
                          {item.caption || <span className="text-[var(--w-fg-alternative)]">(캡션 없음)</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--w-fg-alternative)]">
                          <span>{formatDate(item.timestamp)}</span>
                          {item.permalink && (
                            <a
                              href={item.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-[var(--w-primary-normal)] hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              열기
                            </a>
                          )}
                          <Link
                            href={`/instagram/comments?media=${encodeURIComponent(item.id)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-[var(--w-primary-normal)] hover:underline inline-flex items-center gap-1"
                          >
                            <Icon name="message" size={11} />
                            댓글 관리
                          </Link>
                        </div>
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const hint = item.caption?.slice(0, 60).trim() ?? "";
                              const params = new URLSearchParams({ from: "channel-insights", outcome: "boost_post" });
                              if (hint) params.set("outcomeHint", hint);
                              router.push(`/create?${params.toString()}`);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--w-primary-soft)] text-[var(--w-primary-normal)] font-semibold text-[11px] leading-none hover:bg-[rgba(0,102,255,0.15)] transition-colors duration-[120ms]"
                          >
                            <Icon name="sparkles" size={11} /> 광고 만들기
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {selectedPostId && (() => {
              const post = recent.find((r) => r.id === selectedPostId);
              if (!post) return null;
              return (
                <div className="w-[300px] shrink-0 sticky top-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold tracking-wide uppercase text-[var(--w-fg-alternative)]">미리보기</span>
                    <button
                      type="button"
                      onClick={() => setSelectedPostId(null)}
                      className="p-1 rounded hover:bg-[var(--w-bg-neutral)] text-[var(--w-fg-alternative)]"
                      aria-label="닫기"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                  <IgPostPreview
                    imageUrl={post.mediaUrl}
                    caption={post.caption}
                    handle={handle}
                    profilePicture={igPicture}
                    timestamp={formatDate(post.timestamp)}
                    likeCount={post.likeCount}
                  />
                  <div className="flex flex-col gap-2 mt-3">
                    {post.permalink && (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--w-line-normal)] text-[13px] font-semibold text-[var(--w-fg-strong)] hover:bg-[var(--w-bg-neutral)] transition-colors"
                      >
                        <Icon name="link" size={13} />
                        Instagram에서 보기
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const hint = post.caption?.slice(0, 60).trim() ?? "";
                        const params = new URLSearchParams({ from: "channel-insights", outcome: "boost_post" });
                        if (hint) params.set("outcomeHint", hint);
                        router.push(`/create?${params.toString()}`);
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--w-primary-soft)] text-[var(--w-primary-normal)] text-[13px] font-semibold hover:bg-[rgba(0,102,255,0.15)] transition-colors"
                    >
                      <Icon name="sparkles" size={13} />
                      광고 만들기
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </Card>
    </>
  );
}

export default function PostsPage() {
  return (
    <Suspense fallback={null}>
      <PostsFlow />
    </Suspense>
  );
}


function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
