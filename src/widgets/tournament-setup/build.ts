// TournamentSetup widget 의 pure 빌더들 — launch-campaign/build.ts 와 같은 분리.
// 위저드가 들고 있던 책임(실/데모 요청 페이로드 직조·챌린저 변형·풀 선택·통과 게이트)을 분리.
// widget = "언제" / 여기 = "어떻게". 단위 테스트 surface = 본 파일의 인터페이스.

import type { TourAxis, TourVariant, TourEnvelope } from "@entities/ab-test/tournament/engine";
import type { TournamentSetup } from "@entities/ab-test/tournament/runner";

// ADR-061 — 봉투 빌더. autoRefill ON 이면 hardCap 까지 충전 단위(=총예산 1봉투)로 자동 충전. ②수렴은 엔진 기본값이라 안 물음.
export function buildEnvelope(f: SetupFormState): TourEnvelope {
  const env: TourEnvelope = { totalBudget: f.totalBudget };
  if (f.autoRefill && f.hardCap > f.totalBudget) {
    env.autoRefill = { addBudget: f.totalBudget, hardCap: f.hardCap };
  }
  return env;
}

// AI 부트스트랩 시 출발 챔피언 CTR 기준선(%) — existing 은 광고 실제 CTR 사용.
export const STARTING_CTR = 1.8;

// 챌린저(B) AI 생성 시 챔피언 대비 변화 폭.
export type Degree = "slight" | "moderate" | "bold";

// 위저드의 챌린저 컴포저 입력 — axis 하나만 챔피언과 다르게.
export type ChallengerInputs = { headline: string; primary: string; image: string };

// 셋업 폼 전체 상태 — 빌더가 읽는 순수 입력.
export type SetupFormState = {
  championMode: "existing" | "ai";
  selected: { ctr: number; name: string } | null;
  champVariant: TourVariant | null;
  productId: string;
  productName: string;
  description: string;
  tone: string;
  objective: string;
  totalBudget: number; // ADR-054 — 토너먼트 총예산(봉투). 소진 시 winner-handling 으로 사람 결정
  autoRefill: boolean; // ADR-061 — 봉투 소진 시 hardCap 까지 자동 충전(opt-in·기본 OFF)
  hardCap: number; // ADR-061 — autoRefill 누적 상한액
  dailyBudget: number;
  chAxis: TourAxis;
  challenger: ChallengerInputs;
  // 실 게재 봉투
  landingUrl: string;
  ctaType: string;
  country: string;
  ageMin: number;
  ageMax: number;
};

// POST /api/tournaments 바디 — Supabase + Meta delivery 봉투.
export type TournamentRequestBody = {
  brandProfileId: string;
  productId: string;
  productName: string;
  brandDescription: string;
  productDescription: string;
  tone: string;
  objective: string;
  mode: "auto";
  envelope: TourEnvelope;
  dailyBudget: number;
  startingCtr: number;
  championSource: "ai" | "existing";
  startingChampion?: TourVariant;
  championSourceName?: string;
  goalId: string;
  linkUrl: string;
  ctaType: string;
  countries: string[];
  ageMin: number;
  ageMax: number;
};

// 출발 챔피언이 기존 광고에서 왔는가 — existing 모드 + 광고 선택 + 변형 확보.
export function isFromExisting(f: SetupFormState): boolean {
  return f.championMode === "existing" && !!f.selected && !!f.champVariant;
}

// 실 유저 — POST /api/tournaments 페이로드. brandProfileId 는 호출자가 활성 프로필에서 넘김.
export function buildTournamentRequest(f: SetupFormState, brandProfileId: string): TournamentRequestBody {
  const fromExisting = isFromExisting(f);
  return {
    brandProfileId: brandProfileId || "default",
    productId: f.productId || "manual",
    productName: f.productName.trim(),
    brandDescription: f.description.trim(),
    productDescription: f.description.trim(),
    tone: f.tone,
    objective: f.objective,
    mode: "auto",
    envelope: buildEnvelope(f),
    dailyBudget: f.dailyBudget,
    startingCtr: fromExisting ? f.selected!.ctr : STARTING_CTR,
    championSource: fromExisting ? "existing" : "ai",
    startingChampion: fromExisting ? f.champVariant! : undefined,
    championSourceName: fromExisting ? f.selected!.name : undefined,
    goalId: f.objective,
    linkUrl: f.landingUrl.trim(),
    ctaType: f.ctaType,
    countries: [f.country],
    ageMin: f.ageMin,
    ageMax: f.ageMax,
  };
}

// 데모 — startTournament 에 넘길 TournamentSetup. brandProfile/product 는 browse 고정.
export function buildDemoSetup(f: SetupFormState): TournamentSetup {
  const fromExisting = isFromExisting(f);
  return {
    brandProfileId: "browse",
    productId: "browse",
    productName: f.productName.trim(),
    brandDescription: f.description.trim(),
    productDescription: f.description.trim(),
    tone: f.tone,
    objective: f.objective,
    envelope: buildEnvelope(f),
    dailyBudget: f.dailyBudget,
    startingCtr: fromExisting ? f.selected!.ctr : STARTING_CTR,
    championSource: fromExisting ? "existing" : "ai",
    startingChampion: fromExisting ? f.champVariant! : undefined,
    championSourceName: fromExisting ? f.selected!.name : undefined,
  };
}

// 챌린저(B) = 챔피언 복제 후 바꾼 축 하나만 교체. 3축 통일(real 은 UI 가 image 를 차단해 도달 X).
export function buildChallengerVariant(axis: TourAxis, champ: TourVariant, inputs: ChallengerInputs): TourVariant {
  switch (axis) {
    case "headline":
      return { ...champ, headline: inputs.headline.trim() };
    case "primary_text":
      return { ...champ, primaryText: inputs.primary.trim() };
    case "image":
      return { ...champ, imageUrl: inputs.image };
  }
}

// 변화 정도 → 후보 풀에서 위치 선택. 살짝=가장 가까운 첫 후보, 많이=가장 먼 끝 후보. 챔피언과 같은 값은 제외.
export function pickFromPool(pool: string[], current: string, degree: Degree): string {
  const filtered = pool.filter((x) => x.trim() && x.trim() !== current.trim());
  const idx = degree === "slight" ? 0 : degree === "bold" ? filtered.length - 1 : Math.floor(filtered.length / 2);
  return filtered[idx] ?? filtered[0] ?? pool[0] ?? "";
}

// 바꿀 요소가 채워졌는지 — 챌린저 대진 성립 조건.
export function challengerReady(axis: TourAxis, inputs: ChallengerInputs): boolean {
  return axis === "headline"
    ? !!inputs.headline.trim()
    : axis === "primary_text"
      ? !!inputs.primary.trim()
      : !!inputs.image;
}

// A/B 설계 스텝 통과 조건 — existing: 챔피언+챌린저 한 요소 / ai: 출발 챔피언 생성 재료.
export function canAdvanceDesign(f: SetupFormState): boolean {
  return f.championMode === "ai"
    ? !!(f.productName.trim() && f.description.trim())
    : !!f.selected && challengerReady(f.chAxis, f.challenger);
}

// 시작 가능 — 게재 조건까지 충족. real 은 랜딩 URL 필수.
export function canStart(f: SetupFormState, real: boolean): boolean {
  return canAdvanceDesign(f) && f.totalBudget > 0 && f.dailyBudget > 0 && (!real || !!f.landingUrl.trim());
}
