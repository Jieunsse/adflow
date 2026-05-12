"use client";

// AI 이미지 생성 (실험) — 최소 UI.
// PRD(docs/PRD-ai-image-gen.md) 의 흐름상 정확한 자리는 디자인 산출물 받은 뒤 확정.
// 이번 단계 범위: "프롬프트(+레퍼런스) → Gemini → 이미지 3장" 이 화면에서 도는지 확인.
// 아직 안 한 것: AI 가 프롬프트를 자동 제안 / 고른 1장을 광고 집행 이미지로 연결 / 1:1 고정 / 라운드별 컨셉·변형 / "더 발전".

import { useState } from "react";
import { useGenerateImage } from "../_hooks/useGenerateImage";
import type { ReferenceImage } from "../_hooks/useGenerateImage";
import { useSuggestImagePrompt } from "../_hooks/useSuggestImagePrompt";
import { useCreative } from "./CreativeProvider";
import { useToast } from "./Toast";

const MAX_REF_MB = 3;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("파일을 읽지 못했어요."));
    r.readAsDataURL(file);
  });
}

// "data:image/png;base64,XXXX" → { mimeType, dataBase64 }
function splitDataUrl(dataUrl: string): ReferenceImage | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  return m ? { mimeType: m[1], dataBase64: m[2] } : null;
}

export default function GeneratedImagesBlock() {
  const { state, dispatch } = useCreative();
  const [prompt, setPrompt] = useState("");
  const [refs, setRefs] = useState<string[]>([]); // DataURL 목록
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const gen = useGenerateImage();
  const suggest = useSuggestImagePrompt();
  const showToast = useToast();

  const hasCopy = !!state.primaryText;

  const handleSuggestPrompt = () => {
    suggest.mutate(
      { headline: state.headline, primaryText: state.primaryText, tone: state.tone },
      {
        onSuccess: (data) => setPrompt(data.prompt),
        onError: () => showToast("프롬프트 제안에 실패했어요, 다시 시도해주세요"),
      },
    );
  };

  const handleAddRefs = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) { showToast("이미지 파일만 첨부할 수 있어요"); continue; }
      if (file.size > MAX_REF_MB * 1024 * 1024) { showToast(`레퍼런스 이미지는 장당 ${MAX_REF_MB}MB 이하예요`); continue; }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setRefs((prev) => [...prev, dataUrl]);
      } catch {
        showToast("이미지를 읽지 못했어요");
      }
    }
  };

  const handleGenerate = () => {
    const p = prompt.trim();
    if (!p) { showToast("이미지 프롬프트를 입력해주세요"); return; }
    const referenceImages = refs.map(splitDataUrl).filter((r): r is ReferenceImage => !!r);
    setSelectedIdx(null);
    gen.mutate(
      { prompt: p, referenceImages: referenceImages.length ? referenceImages : undefined, count: 3 },
      {
        onSuccess: (data) => {
          const [a, b, c] = data.images;
          const triple: [string, string, string] = [a ?? "", b ?? "", c ?? ""];
          dispatch({ type: "SET_GENERATED_IMAGES", images: triple });
          if (data.images.length < 3) showToast(`이미지 ${data.images.length}장만 생성됐어요`);
        },
        onError: (err) => {
          console.error("[generate-image]", err);
          showToast("이미지 생성에 실패했어요, 다시 시도해주세요");
        },
      },
    );
  };

  const generated = (state.generatedImages ?? []).filter(Boolean);

  return (
    <section className="result-section">
      <h3 className="subhead-ai">
        AI 이미지 생성{" "}
        <span className="badge badge--neutral" style={{ marginLeft: 6 }}>실험</span>
      </h3>

      {hasCopy ? (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={suggest.isPending}
            onClick={handleSuggestPrompt}
            style={{ whiteSpace: "nowrap" }}
          >
            {suggest.isPending ? "제안 중…" : "✦ 카피로 프롬프트 제안받기"}
          </button>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            방금 생성한 광고 카피를 기반으로 AI가 이미지 프롬프트를 써드려요
          </span>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
          카피를 먼저 만들면 AI가 이미지 프롬프트를 자동으로 제안해 드려요 (선택사항)
        </p>
      )}

      <textarea
        className="textarea"
        aria-label="이미지 프롬프트"
        placeholder="예: 미니멀한 욕실 선반에 놓인 비건 수분크림, 아침 햇살, 파스텔 톤"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
      />

      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap", marginTop: "var(--space-2)" }}>
        <label className="btn btn--ghost" style={{ cursor: "pointer", margin: 0 }}>
          레퍼런스 첨부 (권장 2~3장)
          <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handleAddRefs(e.target.files)} />
        </label>
        {refs.length > 0 && (
          <button type="button" className="btn btn--ghost" onClick={() => setRefs([])}>
            레퍼런스 비우기 ({refs.length})
          </button>
        )}
        <button type="button" className="btn btn--primary" disabled={gen.isPending} onClick={handleGenerate}>
          {gen.isPending ? "생성 중…" : "이미지 3장 생성하기"}
        </button>
      </div>

      {refs.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
          {refs.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={`레퍼런스 ${i + 1}`} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }} />
          ))}
        </div>
      )}

      {gen.isPending && (
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: "var(--space-3)" }}>
          AI가 이미지를 만들고 있어요… (10~30초 정도 걸려요)
        </p>
      )}

      {generated.length > 0 && !gen.isPending && (
        <>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "var(--space-3) 0 var(--space-2)" }}>
            마음에 드는 1장을 골라주세요 (최종 광고 이미지)
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-2)" }}>
            {generated.map((src, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={selectedIdx === i}
                onClick={() => setSelectedIdx(i)}
                style={{
                  padding: 0,
                  border: selectedIdx === i ? "2px solid var(--accent)" : "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  overflow: "hidden",
                  cursor: "pointer",
                  background: "none",
                  lineHeight: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`생성 이미지 ${i + 1}`} style={{ width: "100%", display: "block", aspectRatio: "1 / 1", objectFit: "cover" }} />
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
            AI가 만든 이미지예요. 광고 정책·저작권·초상권은 직접 확인해주세요.
          </p>
        </>
      )}
    </section>
  );
}
