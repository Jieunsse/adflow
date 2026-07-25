import type { IconName } from '@shared/ui/Icon'

export const TONES = [
  { id: 'warm' as const, label: '감성적·따뜻하게', promptDesc: '감성적이고 따뜻한 톤' },
  { id: 'pro' as const, label: '전문적·신뢰감 있게', promptDesc: '전문적이고 신뢰감 있는 톤' },
  { id: 'trendy' as const, label: '트렌디·발랄하게', promptDesc: '트렌디하고 발랄한 톤' },
] as const

// Meta CTA 버튼 타입 — label은 Meta가 한국어로 실제 표시하는 문구예요.
// Phase 1 goal 확장으로 LIKE_PAGE / MESSAGE_PAGE / CALL_NOW 가 추가됐어요.
export const CTAS = [
  { id: 'buy'        as const, label: '지금 구매하기' },     // SHOP_NOW
  { id: 'learn'      as const, label: '자세히 알아보기' },   // LEARN_MORE
  { id: 'sample'     as const, label: '혜택 받기' },         // GET_OFFER
  { id: 'like_page'  as const, label: '페이지 좋아요' },     // LIKE_PAGE
  { id: 'message'    as const, label: '메시지 보내기' },     // MESSAGE_PAGE
  { id: 'call'       as const, label: '지금 전화하기' },     // CALL_NOW
] as const

export const IMAGES = [
  { id: 'img1' as const, art: 'art-cyan' },
  { id: 'img2' as const, art: 'art-lavender' },
  { id: 'img3' as const, art: 'art-warmgreen' },
] as const

export type ToneId = (typeof TONES)[number]['id']
export type CtaId = (typeof CTAS)[number]['id']
export type ImageId = (typeof IMAGES)[number]['id']

export const TONE_PROMPT_DESC: Record<ToneId, string> = {
  warm: '감성적이고 따뜻한 톤',
  pro: '전문적이고 신뢰감 있는 톤',
  trendy: '트렌디하고 발랄한 톤',
}

export const CTA_LABEL: Record<CtaId, string> = {
  buy:       '지금 구매하기',
  learn:     '자세히 알아보기',
  sample:    '혜택 받기',
  like_page: '페이지 좋아요',
  message:   '메시지 보내기',
  call:      '지금 전화하기',
}

export const CTA_META_TYPE: Record<CtaId, string> = {
  buy: 'SHOP_NOW',
  learn: 'LEARN_MORE',
  sample: 'GET_OFFER',
  like_page: 'LIKE_PAGE',
  message: 'MESSAGE_PAGE',
  call: 'CALL_NOW',
}

// 도메인 어휘 — .document/CONTEXT.md §Outcome / §Campaign Objective.
// Outcome = STEP 01 사용자 입력 칩 (Phase 1 7 + Phase 2 3 = 10 종). Objective = 그 매핑 결과 (Meta enum).
// chip → Meta objective / default CTA 매핑은 OBJECTIVES_PHASE1[].metaObjective / .defaultCta 가 단일 source.
// 파생 룩업·selector 는 entities/creative/outcome-routing.ts.
export type OutcomeChip = ObjectiveId
export type Objective = MetaObjective

export const IMAGE_ART: Record<ImageId, string> = {
  img1: 'art-cyan',
  img2: 'art-lavender',
  img3: 'art-warmgreen',
}

// Phase 1 — dev mode probe 로 Campaign + AdSet 통과 검증된 7 광고 목표.
//
// 필드 의미:
//  - id              : ObjectiveId / OutcomeChip — STEP 01 칩 토글 키
//  - label           : 칩/배지 라벨 (예: "페이지 팔로우")
//  - outcomeLabel    : STEP 01 칩 큰 라벨 (마케터 의도 자연어, 예: "페이지 팔로워 늘리기")
//  - outcomeDescription : STEP 01 세부 목표 카드 한 줄 설명 — 비슷한 목표 간 차이를 드러냄
//  - iconName        : STEP 01 카드 아이콘 — @shared/ui/Icon 의 IconName
//  - metaObjective   : Meta Campaign.objective enum
//  - optimizationGoal: Meta AdSet.optimization_goal — goal 단위로 분기
//  - destinationType : Meta AdSet.destination_type (optional). REACH/POST_ENGAGEMENT 는 없음
//  - promotedObject  : 'page' | 'pixel' | 'app' | null — AdSet.promoted_object 매핑 키
//  - defaultCta      : 칩 선택 시 자동 적용되는 CTA. 디테일 모드 override 가능
//  - defaultLink     : 'user_input' | 'page_url' | 'messenger' — STEP 02 landingUrl prefill 키
//  - copyTone        : Gemini 시스템 프롬프트에 들어가는 카피 방향 문구
export const OBJECTIVES_PHASE1 = [
  {
    id: 'awareness' as const,
    iconName: 'megaphone' as const,
    metaObjective: 'OUTCOME_AWARENESS' as const,
    optimizationGoal: 'REACH' as const,
    destinationType: null,
    promotedObject: null,
    defaultCta: 'learn' as const,
    defaultLink: 'user_input' as const,
    label: '인지도',
    outcomeLabel: '인지도 넓히기',
    outcomeDescription: '구매보다 먼저, 최대한 많은 사람에게 브랜드를 알려요',
    copyTone: '브랜드 약속·메모러블·짧고 강한 헤드라인, 첫 노출 인상 위주',
  },
  {
    id: 'traffic' as const,
    iconName: 'globe' as const,
    metaObjective: 'OUTCOME_TRAFFIC' as const,
    optimizationGoal: 'LINK_CLICKS' as const,
    destinationType: 'WEBSITE' as const,
    promotedObject: null,
    defaultCta: 'learn' as const,
    defaultLink: 'user_input' as const,
    label: '웹사이트 방문',
    outcomeLabel: '사이트 방문 유도',
    outcomeDescription: '웹사이트·쇼핑몰 등 외부 페이지로 방문을 보내요',
    copyTone: '클릭 유도·urgency·명확한 CTA 강조',
  },
  {
    id: 'traffic_page_visit' as const,
    iconName: 'facebook' as const,
    metaObjective: 'OUTCOME_TRAFFIC' as const,
    optimizationGoal: 'LANDING_PAGE_VIEWS' as const,
    destinationType: 'WEBSITE' as const,
    promotedObject: null,
    defaultCta: 'learn' as const,
    defaultLink: 'page_url' as const,
    label: '페이지 방문',
    outcomeLabel: '페이지 둘러보게 하기',
    outcomeDescription: 'Facebook 페이지로 데려와 게시물·정보를 둘러보게 해요',
    copyTone: '페이지 방문 유도·"확인해 보세요"·브랜드 호기심 자극',
  },
  {
    id: 'engagement' as const,
    iconName: 'sparkles' as const,
    metaObjective: 'OUTCOME_ENGAGEMENT' as const,
    optimizationGoal: 'POST_ENGAGEMENT' as const,
    destinationType: null,
    promotedObject: null,
    defaultCta: 'learn' as const,
    defaultLink: 'user_input' as const,
    label: '게시물 참여',
    outcomeLabel: '반응·댓글·공유 키우기',
    outcomeDescription: '게시물에 좋아요·댓글·공유가 많이 달리게 해요',
    copyTone: '공감·질문 던지기·대화형, 댓글/공유를 유도',
  },
  {
    id: 'engagement_page_likes' as const,
    iconName: 'heart' as const,
    metaObjective: 'OUTCOME_ENGAGEMENT' as const,
    optimizationGoal: 'PAGE_LIKES' as const,
    destinationType: 'ON_PAGE' as const,
    promotedObject: 'page' as const,
    defaultCta: 'like_page' as const,
    defaultLink: 'page_url' as const,
    label: '페이지 팔로우',
    outcomeLabel: '페이지 팔로워 늘리기',
    outcomeDescription: '페이지를 좋아요·팔로우할 사람에게 보여줘요',
    copyTone: '팔로우 가치 강조·정기 콘텐츠 약속·커뮤니티 소속감',
  },
  {
    id: 'engagement_messages' as const,
    iconName: 'message' as const,
    metaObjective: 'OUTCOME_ENGAGEMENT' as const,
    optimizationGoal: 'CONVERSATIONS' as const,
    destinationType: 'MESSENGER' as const,
    promotedObject: 'page' as const,
    defaultCta: 'message' as const,
    defaultLink: 'messenger' as const,
    label: '메시지 받기',
    outcomeLabel: '메시지 대화 시작하기',
    outcomeDescription: '광고를 누르면 바로 메시지 대화가 시작돼요',
    copyTone: '1:1 대화 유도·"바로 답변 드려요"·문턱 낮은 질문 예시',
  },
  {
    id: 'leads_call' as const,
    iconName: 'phone' as const,
    metaObjective: 'OUTCOME_LEADS' as const,
    optimizationGoal: 'QUALITY_CALL' as const,
    destinationType: 'PHONE_CALL' as const,
    promotedObject: 'page' as const,
    defaultCta: 'call' as const,
    defaultLink: 'page_url' as const,
    label: '전화 받기',
    outcomeLabel: '전화 문의 받기',
    outcomeDescription: '전화 문의할 가능성이 높은 사람에게 보여줘요',
    copyTone: '전화 한 통의 가치 강조·"바로 연결됩니다"·통화 시간 안내',
  },
  {
    id: 'boost_post' as const,
    iconName: 'instagram' as const,
    metaObjective: 'OUTCOME_ENGAGEMENT' as const,
    optimizationGoal: 'POST_ENGAGEMENT' as const,
    destinationType: null,
    promotedObject: 'page' as const,
    defaultCta: 'learn' as const,
    defaultLink: 'page_url' as const,
    label: '콘텐츠 홍보',
    outcomeLabel: '기존 게시물 홍보하기',
    outcomeDescription: '이미 올린 게시물을 더 많은 사람에게 퍼뜨려요',
    copyTone: '게시물 참여 확대·자연스러운 노출·광고 느낌 최소화',
  },
] as const

// Phase 2 — 추가 인프라(Pixel/Lead Form/App SDK) 필요. UI 상 "곧 열려요" 칩으로 잔존.
export const OBJECTIVES_PHASE2 = [
  {
    id: 'leads' as const,
    iconName: 'target' as const,
    metaObjective: 'OUTCOME_LEADS' as const,
    optimizationGoal: 'LEAD_GENERATION' as const,
    destinationType: 'ON_AD' as const,
    promotedObject: 'page' as const,
    defaultCta: 'buy' as const,
    defaultLink: 'user_input' as const,
    label: '잠재고객',
    outcomeLabel: '가입자 확보',
    copyTone: '가입 유도·리드 폼 강조·개인정보 신뢰 강조',
  },
  {
    id: 'sales' as const,
    iconName: 'chart' as const,
    metaObjective: 'OUTCOME_SALES' as const,
    optimizationGoal: 'OFFSITE_CONVERSIONS' as const,
    destinationType: 'WEBSITE' as const,
    promotedObject: 'pixel' as const,
    defaultCta: 'buy' as const,
    defaultLink: 'user_input' as const,
    label: '판매',
    outcomeLabel: '매출 향상',
    copyTone: '구매 전환·가격 혜택·사회적 증거 강조',
  },
  {
    id: 'app_promotion' as const,
    iconName: 'monitor' as const,
    metaObjective: 'OUTCOME_APP_PROMOTION' as const,
    optimizationGoal: 'APP_INSTALLS' as const,
    destinationType: null,
    promotedObject: 'app' as const,
    defaultCta: 'buy' as const,
    defaultLink: 'user_input' as const,
    label: '앱 홍보',
    outcomeLabel: '앱 설치 유도',
    copyTone: '앱 설치 유도·핵심 기능 소개·간편함 강조',
  },
] as const

export const OBJECTIVES_ALL = [...OBJECTIVES_PHASE1, ...OBJECTIVES_PHASE2] as const

export type ObjectivePhase1Id = (typeof OBJECTIVES_PHASE1)[number]['id']
export type ObjectivePhase2Id = (typeof OBJECTIVES_PHASE2)[number]['id']
export type ObjectiveId = ObjectivePhase1Id | ObjectivePhase2Id
export type MetaObjective = (typeof OBJECTIVES_ALL)[number]['metaObjective']
// AdSet.optimization_goal 의 합집합 — meta-ads 빌더에서 string 이 아닌 enum 으로 잡으려 export.
export type OptimizationGoal = (typeof OBJECTIVES_ALL)[number]['optimizationGoal']
export type DestinationType = NonNullable<(typeof OBJECTIVES_ALL)[number]['destinationType']>
export type PromotedObjectKey = NonNullable<(typeof OBJECTIVES_ALL)[number]['promotedObject']>
export type DefaultLinkKind = (typeof OBJECTIVES_ALL)[number]['defaultLink']

export function findObjective(id: ObjectiveId) {
  return OBJECTIVES_ALL.find((o) => o.id === id)!
}

// Copy Hook (카피 훅) — ADR-029 / PRD-copy-hook. BTNARUST 8종. 카피의 주력 설득 각도.
export type CopyHook =
  | 'benefit' | 'trust' | 'number' | 'rush'
  | 'unique' | 'trendy' | 'surprise' | 'story'

export interface CopyHookDef {
  id: CopyHook
  label: string      // 배지·칩 표시 ("Number")
  ko: string         // 한국어 짧은 이름 ("수치")
  icon: IconName     // 카드 아이콘
  uiDesc: string     // 화면 노출용 한 줄 — 유저가 읽고 고르는 설명
  promptDesc: string // Gemini 주입용 한 줄
}

export const COPY_HOOKS: CopyHookDef[] = [
  { id: 'benefit',  label: 'Benefit',  ko: '혜택',    icon: 'heart',        uiDesc: '고객이 얻는 변화를\n먼저 말해요',     promptDesc: '이 광고가 삶에 무엇을 바꿔주는지 먼저 답하는 혜택 중심' },
  { id: 'trust',    label: 'Trust',    ko: '신뢰',    icon: 'check-circle', uiDesc: '근거와 후기로\n믿음을 줘요',           promptDesc: '출처·증언·레퍼런스로 믿게 만드는 신뢰 중심' },
  { id: 'number',   label: 'Number',   ko: '수치',    icon: 'hash',         uiDesc: '구체적인 숫자로\n설득해요',           promptDesc: '구체적 수치로 증명하는' },
  { id: 'rush',     label: 'Rush',     ko: '긴급',    icon: 'clock',        uiDesc: '지금 행동해야 할\n이유를 만들어요',   promptDesc: '시간압박·혜택소멸·한정성으로 지금 행동을 유발하는' },
  { id: 'unique',   label: 'Unique',   ko: '차별화',  icon: 'asterisk',     uiDesc: '남들과 다른 점을\n분명하게 보여줘요', promptDesc: '기능이 아닌 경험·관점·접근의 차별화를 내세우는' },
  { id: 'trendy',   label: 'Trendy',   ko: '트렌드',  icon: 'trend-up',     uiDesc: '요즘 뜨는 흐름에\n자연스럽게 얹어요', promptDesc: '지금 뜨는 키워드·트렌드에 자연스럽게 접점을 만드는' },
  { id: 'surprise', label: 'Surprise', ko: '반전',    icon: 'eye',          uiDesc: '예상을 뒤집어\n시선을 멈추게 해요',   promptDesc: '놀라움 → 이해 → 납득 구조로 시선을 끄는' },
  { id: 'story',    label: 'Story',    ko: '스토리',  icon: 'comment',      uiDesc: '이야기로 끌어들여\n끝까지 읽게 해요', promptDesc: '개발 비화·역전 성공담 등 이야기로 몰입시키는' },
]

export const COPY_HOOK_MAP: Record<CopyHook, CopyHookDef> =
  Object.fromEntries(COPY_HOOKS.map((h) => [h.id, h])) as Record<CopyHook, CopyHookDef>

export function findHook(id: CopyHook): CopyHookDef {
  return COPY_HOOK_MAP[id]
}

// Outcome 종속 추천 풀 — metaObjective 단위 (8 칩이 3~6 objective 로 모임). Rush 는 기본 제외(디테일에서 추가).
export const HOOK_RECOMMENDATIONS_BY_OBJECTIVE: Record<MetaObjective, [CopyHook, CopyHook, CopyHook]> = {
  OUTCOME_AWARENESS:     ['surprise', 'story', 'unique'],
  OUTCOME_ENGAGEMENT:    ['trendy', 'story', 'surprise'],
  OUTCOME_TRAFFIC:       ['number', 'trust', 'benefit'],
  OUTCOME_LEADS:         ['trust', 'number', 'benefit'],
  OUTCOME_SALES:         ['number', 'trust', 'benefit'],
  OUTCOME_APP_PROMOTION: ['benefit', 'number', 'trust'],
}

// 추천 3훅 — Outcome 칩 → metaObjective → 풀. STEP 02 생성 시 각 본문 변형 1개씩 끌고 감.
export function recommendedHooks(outcome: ObjectiveId): [CopyHook, CopyHook, CopyHook] {
  return HOOK_RECOMMENDATIONS_BY_OBJECTIVE[findObjective(outcome).metaObjective]
}

export const GOAL_RESULT: Record<ObjectivePhase1Id, { noun: string; costLabel: string }> = {
  awareness:             { noun: '노출',          costLabel: 'CPM' },
  traffic:               { noun: '클릭',          costLabel: 'CPC' },
  traffic_page_visit:    { noun: '페이지 방문',   costLabel: '페이지 방문당 비용' },
  engagement:            { noun: '참여',          costLabel: '참여당 비용' },
  engagement_page_likes: { noun: '페이지 좋아요', costLabel: '좋아요당 비용' },
  engagement_messages:   { noun: '대화',          costLabel: '대화당 비용' },
  leads_call:            { noun: '통화',          costLabel: '통화당 비용' },
  boost_post:            { noun: '참여',          costLabel: '참여당 비용' },
}
