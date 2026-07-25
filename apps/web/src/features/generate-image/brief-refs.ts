// brief 모드 입력(연출컷·로고·참고 자료) → 생성 ref 조립 — AiImageBlock 에서 분리.
// 단위 테스트 surface = buildBriefRefs / splitDataUrl / computeBriefTargets.

import type { ReferenceImage } from "@/lib/gemini-image";
import type { ReferenceMaterial } from "@shared/lib/referenceMaterials";

// data:<mime>;base64,<data> → ReferenceImage. 형식이 안 맞으면 null.
export function splitDataUrl(dataUrl: string): ReferenceImage | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  return m ? { mimeType: m[1], dataBase64: m[2] } : null;
}

// 빈(미생성) 슬롯 인덱스. null = 한 번도 생성 안 함 → 전부 대상.
export function computeBriefTargets(generated: [string, string, string] | null): number[] {
  const cur = generated ?? ["", "", ""];
  return [0, 1, 2].filter((i) => !cur[i]);
}

export type BriefRefInput = {
  scenes: string[]; // data URL
  logo: string | null; // data URL
  materials: ReferenceMaterial[];
};

// 연출컷·로고·선택 자료 → 전 variant 공통 ref(이미지·PDF) + txt 자료 본문(프롬프트에 덧붙일 텍스트).
export function buildBriefRefs({ scenes, logo, materials }: BriefRefInput): {
  sceneRefs: ReferenceImage[];
  txtText: string;
} {
  const combined = [...scenes, ...(logo ? [logo] : [])];
  const materialImages = materials
    .filter((m) => m.type === "image" || m.type === "pdf")
    .map((m) => splitDataUrl(m.storageUrl))
    .filter((r): r is ReferenceImage => !!r);
  const sceneRefs = [
    ...combined.map(splitDataUrl).filter((r): r is ReferenceImage => !!r),
    ...materialImages,
  ];

  const txtText = materials
    .filter((m) => m.type === "txt")
    .map((m) => {
      if (m.storageUrl.startsWith("data:text/plain;base64,")) {
        try {
          return `[참고 자료: ${m.name}]\n${atob(m.storageUrl.split(",")[1])}`;
        } catch {
          return null;
        }
      }
      return null;
    })
    .filter(Boolean)
    .join("\n\n");

  return { sceneRefs, txtText };
}
