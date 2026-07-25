// generate-image-stream SSE 파서 — variants[] 를 POST 하고 슬롯별 이미지를 스트림으로 받는다.
// 소재 만들기(AiImageBlock)·A/B 토너먼트 셋업(ChallengerImageGen) 공통.

import type { GenerateImageParams } from "@/lib/gemini-image";

export async function fetchImageStream(
  params: GenerateImageParams,
  onImage: (index: number, image: string) => void,
): Promise<void> {
  const res = await fetch("/api/generate-image-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok || !res.body) throw new Error("이미지 생성 요청에 실패했어요.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      let parsed: { index?: number; image?: string; error?: string };
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (parsed.error) throw new Error(parsed.error);
      if (typeof parsed.index === "number" && parsed.image) {
        onImage(parsed.index, parsed.image);
      }
    }
  }
}
