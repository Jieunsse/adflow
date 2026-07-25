// generate-image-stream SSE 의 pure 파서 + 얇은 fetch 셸 — AiImageBlock 에서 분리.
// 위험 지점은 JSON 한 줄 파싱이 아니라 "data: 한 줄이 청크 경계에서 잘림" → feedChunk 가 그걸 이월 버퍼로 흡수.
// 단위 테스트 surface = feedChunk.

import type { GenerateImageParams } from "@/lib/gemini-image";

// SSE 한 묶음이 만들어내는 이벤트. done = 스트림 종료, error = 서버 보고 오류.
export type ImageStreamEvent =
  | { kind: "image"; index: number; image: string }
  | { kind: "error"; message: string }
  | { kind: "done" };

// 순수 상태머신 — 이월 버퍼 + 새 청크 → 완성 이벤트들 + 남은 버퍼(rest).
// data: 한 줄이 청크 중간에서 끊겨도 rest 로 이월돼 다음 호출에서 합쳐진다.
export function feedChunk(buffer: string, chunk: string): { events: ImageStreamEvent[]; rest: string } {
  const lines = (buffer + chunk).split("\n");
  const rest = lines.pop() ?? ""; // 마지막 미완성 줄은 다음 청크로 이월
  const events: ImageStreamEvent[] = [];
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (data === "[DONE]") {
      events.push({ kind: "done" });
      continue;
    }
    let parsed: { index?: number; image?: string; error?: string };
    try {
      parsed = JSON.parse(data);
    } catch {
      continue;
    }
    if (parsed.error) {
      events.push({ kind: "error", message: parsed.error });
      continue;
    }
    if (typeof parsed.index === "number" && parsed.image) {
      events.push({ kind: "image", index: parsed.index, image: parsed.image });
    }
  }
  return { events, rest };
}

// IO 셸 — 스트림을 읽어 feedChunk 로 파싱, image 는 콜백, done 은 종료, error 는 throw.
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
    const { events, rest } = feedChunk(buffer, decoder.decode(value, { stream: true }));
    buffer = rest;
    for (const e of events) {
      if (e.kind === "error") throw new Error(e.message);
      if (e.kind === "done") return;
      onImage(e.index, e.image);
    }
  }
}
