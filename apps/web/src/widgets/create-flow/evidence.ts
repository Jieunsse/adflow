// 시안 2b "문장에 쓰인 근거" — 본문에 브랜드 프로필의 근거 문구가 실제로 들어갔는지만 본다.
// 추측하지 않는다: 문자열이 본문에 그대로 있으면 확인됨, 없으면 "이번 본문에서는 빠졌어요".

export type Segment = { text: string; hit: boolean };

/** 근거 문구별 사용 여부. 긴 문구가 먼저 오게 정렬해 부분 문구에 먹히지 않게 한다. */
export function proofUsage(body: string, proofPoints: string[]): { text: string; used: boolean }[] {
  return proofPoints
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({ text, used: body.includes(text) }));
}

/** 본문을 근거 문구 기준으로 잘라, 하이라이트할 조각과 아닌 조각으로 나눈다. */
export function highlightSegments(body: string, proofPoints: string[]): Segment[] {
  const needles = proofPoints
    .map((t) => t.trim())
    .filter((t) => t && body.includes(t))
    .sort((a, b) => b.length - a.length);
  if (needles.length === 0) return [{ text: body, hit: false }];

  const out: Segment[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    let bestAt = -1;
    let bestNeedle = "";
    for (const n of needles) {
      const at = body.indexOf(n, cursor);
      // 더 앞선 위치 우선, 같은 위치면 더 긴 문구 우선(needles 가 이미 길이순).
      if (at !== -1 && (bestAt === -1 || at < bestAt)) {
        bestAt = at;
        bestNeedle = n;
      }
    }
    if (bestAt === -1) {
      out.push({ text: body.slice(cursor), hit: false });
      break;
    }
    if (bestAt > cursor) out.push({ text: body.slice(cursor, bestAt), hit: false });
    out.push({ text: bestNeedle, hit: true });
    cursor = bestAt + bestNeedle.length;
  }
  return out.filter((s) => s.text.length > 0);
}
