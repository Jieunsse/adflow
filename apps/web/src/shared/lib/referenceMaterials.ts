"use client";

import { useCallback, useEffect, useState } from "react";

export interface ReferenceMaterial {
  id: string;
  brandProfileId: string;
  name: string;
  type: "image" | "pdf" | "txt";
  mimeType: string;
  sizeBytes: number;
  /** Supabase public URL (Supabase 모드) 또는 base64 data URL (localStorage 폴백) */
  storageUrl: string;
  uploadedAt: number;
}

const ACCEPTED_TYPES: Record<string, ReferenceMaterial["type"]> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "application/pdf": "pdf",
  "text/plain": "txt",
};

const LOCAL_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB

function localKey(brandProfileId: string) {
  return `adflow:ref-materials:${brandProfileId}`;
}

function readLocal(brandProfileId: string): ReferenceMaterial[] {
  try {
    return JSON.parse(localStorage.getItem(localKey(brandProfileId)) ?? "[]") as ReferenceMaterial[];
  } catch {
    return [];
  }
}

function writeLocal(brandProfileId: string, items: ReferenceMaterial[]): void {
  try {
    localStorage.setItem(localKey(brandProfileId), JSON.stringify(items));
  } catch {}
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("파일을 읽지 못했어요."));
    r.readAsDataURL(file);
  });
}

function inferType(mimeType: string): ReferenceMaterial["type"] | null {
  return ACCEPTED_TYPES[mimeType] ?? null;
}

const useSupabase = typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_SUPABASE_URL;

export function useReferenceMaterials(brandProfileId: string) {
  const [materials, setMaterials] = useState<ReferenceMaterial[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!brandProfileId) return;
    if (!useSupabase) {
      setMaterials(readLocal(brandProfileId));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/brand-profile/${brandProfileId}/reference-materials`);
      if (!res.ok) throw new Error("fetch failed");
      setMaterials((await res.json()) as ReferenceMaterial[]);
    } catch {
      setMaterials(readLocal(brandProfileId));
    } finally {
      setLoading(false);
    }
  }, [brandProfileId]);

  useEffect(() => { refresh(); }, [refresh]);

  const upload = useCallback(async (file: File): Promise<ReferenceMaterial> => {
    const type = inferType(file.type);
    if (!type) throw new Error("지원하지 않는 파일 형식이에요 (이미지·PDF·TXT만 가능해요)");

    if (!useSupabase) {
      if (file.size > LOCAL_SIZE_LIMIT) throw new Error("로컬 저장 시 파일은 5MB 이하여야 해요");
      const dataUrl = await readFileAsDataUrl(file);
      const item: ReferenceMaterial = {
        id: `ref_${crypto.randomUUID()}`,
        brandProfileId,
        name: file.name,
        type,
        mimeType: file.type,
        sizeBytes: file.size,
        storageUrl: dataUrl,
        uploadedAt: Date.now(),
      };
      const next = [...readLocal(brandProfileId), item];
      writeLocal(brandProfileId, next);
      setMaterials(next);
      return item;
    }

    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/brand-profile/${brandProfileId}/reference-materials`, {
      method: "POST",
      body,
    });
    if (!res.ok) {
      // API 실패 → localStorage 폴백
      if (file.size > LOCAL_SIZE_LIMIT) throw new Error("파일이 너무 커요 (5MB 이하로 올려주세요)");
      const dataUrl = await readFileAsDataUrl(file);
      const item: ReferenceMaterial = {
        id: `ref_${crypto.randomUUID()}`,
        brandProfileId,
        name: file.name,
        type,
        mimeType: file.type,
        sizeBytes: file.size,
        storageUrl: dataUrl,
        uploadedAt: Date.now(),
      };
      const next = [...readLocal(brandProfileId), item];
      writeLocal(brandProfileId, next);
      setMaterials(next);
      return item;
    }
    const item = (await res.json()) as ReferenceMaterial;
    setMaterials((prev) => [...prev, item]);
    return item;
  }, [brandProfileId]);

  const remove = useCallback(async (id: string): Promise<void> => {
    if (!useSupabase) {
      const next = readLocal(brandProfileId).filter((m) => m.id !== id);
      writeLocal(brandProfileId, next);
      setMaterials(next);
      return;
    }
    try {
      await fetch(`/api/brand-profile/${brandProfileId}/reference-materials/${id}`, { method: "DELETE" });
    } catch {}
    // 로컬에도 있을 수 있으므로 항상 삭제
    const next = readLocal(brandProfileId).filter((m) => m.id !== id);
    writeLocal(brandProfileId, next);
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }, [brandProfileId]);

  return { materials, loading, upload, remove, refresh };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
