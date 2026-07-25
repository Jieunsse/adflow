// 레퍼런스 이미지 유틸 — 파일·URL 을 generate-image 의 base64 ReferenceImage 로 변환.
// 소재 만들기(AiImageBlock)·A/B 토너먼트 셋업(ChallengerImageGen) 공통.

import type { ReferenceImage } from "@/lib/gemini-image";

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("파일을 읽지 못했어요."));
    r.readAsDataURL(file);
  });
}

export function splitDataUrl(dataUrl: string): ReferenceImage | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  return m ? { mimeType: m[1], dataBase64: m[2] } : null;
}

// URL(원격 또는 data:)을 Package Reference 용 base64 ReferenceImage 로 변환.
export async function urlToRef(url: string): Promise<{ ref: ReferenceImage; preview: string } | null> {
  try {
    if (url.startsWith("data:")) {
      const ref = splitDataUrl(url);
      return ref ? { ref, preview: url } : null;
    }
    const blob = await (await fetch(url)).blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("이미지 인코딩 실패"));
      r.readAsDataURL(blob);
    });
    const ref = splitDataUrl(dataUrl);
    return ref ? { ref, preview: dataUrl } : null;
  } catch {
    return null;
  }
}
