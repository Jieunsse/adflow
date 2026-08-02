// 둘러보기 모드의 이미지 3컷 — ADR-033 시연 레이어.
// 둘러보기는 백엔드에 닿지 않는다. 컨셉 제안(/api/suggest-image-concepts)도, 이미지 생성도 부르지 않고
// 여기 적어 둔 그린루틴 예시 컷을 쓴다. 라벨·설명은 실제 사진에 맞춰 손으로 적었다.
//
// 고른 제품이 있으면 그 사진을 첫 컷으로 — 브리프에서 고른 것이 결과로 이어지는 게 보여야 한다.
// 무작위를 쓰지 않는다: 같은 입력이면 늘 같은 3컷이라 시연이 매번 똑같이 재현된다.

export type BrowseShot = { url: string; label: string; note: string };

const DEMO_SHOTS: BrowseShot[] = [
  {
    url: "/demo/library/cream.jpg",
    label: "제품컷 · 클로즈업 · 베이지",
    note: "제품을 정면에서 크게 — 용기와 제형이 한눈에 들어와요.",
  },
  {
    url: "/demo/library/serum.jpg",
    label: "스튜디오 · 세로컷 · 소프트 톤",
    note: "위쪽 여백이 넓어 헤드라인을 얹기 좋아요.",
  },
  {
    url: "/demo/library/pad.jpg",
    label: "탑다운 · 사용 장면 · 자연광",
    note: "쓰는 장면이라 피드에서 광고 티가 덜 나요.",
  },
  {
    url: "/demo/library/toner.jpg",
    label: "제품컷 · 미니멀 · 그린",
    note: "군더더기 없는 구도 — 성분 메시지와 톤이 맞아요.",
  },
  {
    url: "/demo/library/pack.jpg",
    label: "플랫레이 · 소품 연출",
    note: "여러 요소를 늘어놓아 브랜드 분위기를 보여줘요.",
  },
  {
    url: "/demo/library/cleanser.jpg",
    label: "제품컷 · 측면 · 부드러운 그림자",
    note: "그림자가 살아 있어 사진처럼 자연스러워요.",
  },
  {
    url: "/demo/library/suncream.png",
    label: "제품컷 · 밝은 톤 · 데일리",
    note: "밝고 가벼운 인상 — 여름 캠페인에 어울려요.",
  },
  {
    url: "/demo/library/lipbalm.png",
    label: "제품컷 · 소형 · 포인트 컷",
    note: "작은 제품을 크게 잡아 눈에 띄게 했어요.",
  },
];

/** 컷 하나가 더 채워지기까지의 간격 — 스트리밍으로 한 장씩 도착하는 느낌을 살린다. */
export const BROWSE_IMAGE_STEP_MS = 700;
/** 컨셉을 "잡는" 데 두는 시간. 실제 제안 API 가 3초 안팎이라 그 절반쯤. */
export const BROWSE_CONCEPT_MS = 1200;

/**
 * 3컷을 고른다. rotate 는 분위기 칩 index — 칩을 바꿔 다시 만들면 다른 컷이 나오게 하는 용도.
 * 제품을 골랐으면 그 사진이 늘 첫 컷이고, 나머지 두 장만 rotate 를 따른다.
 */
export function pickBrowseShots(
  productImageUrl: string | null | undefined,
  rotate = 0,
): [BrowseShot, BrowseShot, BrowseShot] {
  const lead = DEMO_SHOTS.find((s) => s.url === productImageUrl) ?? null;
  const rest = DEMO_SHOTS.filter((s) => s !== lead);
  const at = (n: number) => rest[(((rotate + n) % rest.length) + rest.length) % rest.length];
  return lead ? [lead, at(0), at(1)] : [at(0), at(1), at(2)];
}
