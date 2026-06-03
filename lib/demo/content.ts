// 데모 STEP 01(광고 만들기) 사전 채움 콘텐츠 — 헤드라인·카피 후보, 이미지 프롬프트, 입력값.
// 실제 Gemini 호출 없이 "이미 생성된 결과"를 보여주기 위한 정적 데이터.

import type { IconName } from "@shared/ui/Icon";
import type { CopyHook } from "@entities/creative/options";
import type { GenerateCreativeResult } from "@/lib/gemini-creative";
import { DEMO_AD_IMAGES } from "./mock-images";

// 왼쪽 InputForm 에 채워질 입력값(읽기용 요약).
export const DEMO_INPUTS = {
  objectiveLabel: "트래픽",
  brand: "그린루틴 — 비건 스킨케어 브랜드. 식물성 성분만 사용한 수분 크림·토너로 민감성 피부도 안심하고 쓸 수 있어요.",
  target: "20~35세 여성, 민감성 피부·자연 성분에 관심, 무자극 스킨케어를 찾는 고객",
  tone: "친근하고 담백한",
  copyRefs: ["비건 수분 크림 톤", "민감성 피부 케어 카피"],
};

// 헤드라인 후보 3 (기본 0번 선택).
export const DEMO_HEADLINES: string[] = [
  "건조한 피부에 수분 한 겹",
  "당기는 피부, 오늘부터 촉촉하게",
  "민감한 피부를 위한 비건 수분 크림",
];

// 기본 텍스트 후보 3 — 서로 다른 설득 방식(훅) + 근거 인용 여부(ADR-031).
export const DEMO_PRIMARY_TEXTS: { text: string; hookLabel: string; proofCited: boolean }[] = [
  {
    text: "식물성 성분만 담은 수분 크림. 민감한 피부도 부담 없이, 바르고 나면 촉촉하게 마무리돼요.",
    hookLabel: "혜택",
    proofCited: false,
  },
  {
    text: "리뉴얼 출시 기념 — 가장 먼저 만나보는 비건 수분 크림. 무향·무색소로 자극은 줄였어요, 지금 확인해보세요.",
    hookLabel: "긴급",
    proofCited: false,
  },
  {
    text: "출시 첫 달 재구매율 절반 이상. 민감성 피부 고객이 다시 찾는 비건 수분 크림이에요.",
    hookLabel: "사회증거",
    proofCited: true,
  },
];

// 이미지 생성 프롬프트(프롬프트 생성 텍스트) — 사전 채움.
export const DEMO_IMAGE_PROMPT =
  "흰색 배경 위 비건 수분 크림 용기 클로즈업, 자연광, 연한 그린·베이지 톤, 식물 잎 소품, 깨끗하고 미니멀한 구성, 광고용 고해상도";

// 목업 이미지 3종(기본 0번 선택).
export const DEMO_IMAGES = DEMO_AD_IMAGES;

export const DEMO_CTA = "SHOP_NOW";

// ADR-033 — Browse Mode 시연 중 generate-creative API 가 Gemini 대신 응답하는 정적 결과.
// 위 DEMO_HEADLINES / DEMO_PRIMARY_TEXTS 를 GenerateCreativeResult shape 로 묶음.
const DEMO_HOOKS: [CopyHook, CopyHook, CopyHook] = ["benefit", "rush", "trust"];

export const DEMO_SUBTITLES: [string, string, string] = [
  "비건 수분 한 겹",
  "민감 피부도 부담 없이",
  "재구매율 절반 이상",
];

export const DEMO_CREATIVE_RESULT: GenerateCreativeResult = {
  headlines: [DEMO_HEADLINES[0], DEMO_HEADLINES[1], DEMO_HEADLINES[2]],
  subtitles: DEMO_SUBTITLES,
  primaryTexts: [DEMO_PRIMARY_TEXTS[0].text, DEMO_PRIMARY_TEXTS[1].text, DEMO_PRIMARY_TEXTS[2].text],
  targeting: { ageMin: 20, ageMax: 40, genders: [] },
  hooks: DEMO_HOOKS,
  proofPointsCited: [
    DEMO_PRIMARY_TEXTS[0].proofCited,
    DEMO_PRIMARY_TEXTS[1].proofCited,
    DEMO_PRIMARY_TEXTS[2].proofCited,
  ],
};

// "AI 추천 받기" 클릭 시 노출되는 목업 카드 3종 — 계정 상태를 분석해 추천했다는 가정.
// 실제 goal-intro 의 Gemini suggest 결과 카드를 미러. 데모 경로(트래픽)를 첫 카드로.
export const DEMO_SUGGESTIONS: {
  objectiveId: string;
  iconName: IconName;
  outcomeLabel: string;
  title: string;
  reason: string;
  isDemoPath?: boolean;
}[] = [
  {
    objectiveId: "traffic",
    iconName: "globe",
    outcomeLabel: "사이트 방문 유도",
    title: "신제품 수분 크림 랜딩 방문 늘리기",
    reason: "최근 게시물 도달은 높지만 사이트 유입이 적어요. 비건 수분 크림 페이지로 방문을 유도해 구매의 출발점을 만들어요.",
    isDemoPath: true,
  },
  {
    objectiveId: "engagement",
    iconName: "sparkles",
    outcomeLabel: "반응·댓글·공유 키우기",
    title: "사용 후기 참여 캠페인",
    reason: "팔로워 대비 댓글·저장 반응이 활발해요. 참여형 광고로 같은 관심을 더 키우면 자연 도달도 함께 올라가요.",
  },
  {
    objectiveId: "awareness",
    iconName: "megaphone",
    outcomeLabel: "인지도 넓히기",
    title: "신규 고객에게 브랜드 각인",
    reason: "재방문 고객 비중은 높지만 신규 도달이 정체됐어요. 인지도 캠페인으로 처음 만나는 고객층을 넓혀보세요.",
  },
];
