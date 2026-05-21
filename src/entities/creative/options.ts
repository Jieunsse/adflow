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

// 아웃컴 칩 선택 시 자동으로 결정되는 default CTA — 디테일 모드 유저는 STEP 02 에서 override 가능.
// 매핑 키는 ObjectiveId (== OutcomeChip). 신규 goal 4개는 각자 맞는 CTA 로 지정.
export const OUTCOME_TO_CTA: Record<string, CtaId> = {
  traffic:               'learn',     // LEARN_MORE — 사이트 방문 유도
  traffic_page_visit:    'learn',     // LEARN_MORE — 페이지 방문 유도
  engagement:            'learn',     // LEARN_MORE — 게시물 참여
  engagement_page_likes: 'like_page', // LIKE_PAGE — 페이지 팔로우
  engagement_messages:   'message',   // MESSAGE_PAGE — 메시지 받기
  leads_call:            'call',      // CALL_NOW — 전화 받기
  awareness:             'learn',     // LEARN_MORE — 인지도
  leads:                 'buy',       // SHOP_NOW — 잠재고객 Instant Form (Phase 2)
  sales:                 'buy',       // SHOP_NOW — 매출 (Phase 2)
  app_promotion:         'buy',       // SHOP_NOW — 앱 설치 (Phase 2)
}

// 도메인 어휘 — .document/CONTEXT.md §Outcome / §Campaign Objective.
// Outcome = STEP 01 사용자 입력 칩 (Phase 1 7 + Phase 2 3 = 10 종). Objective = 그 매핑 결과 (Meta enum).
export type OutcomeChip = ObjectiveId
export type Objective = MetaObjective

// 아웃컴 칩 → Meta Campaign Objective 매핑. N:1 — 한 Meta objective 가 여러 chip 으로 표현될 수 있음.
export const OUTCOME_TO_OBJECTIVE: Record<OutcomeChip, Objective> = {
  traffic:               'OUTCOME_TRAFFIC',
  traffic_page_visit:    'OUTCOME_TRAFFIC',
  engagement:            'OUTCOME_ENGAGEMENT',
  engagement_page_likes: 'OUTCOME_ENGAGEMENT',
  engagement_messages:   'OUTCOME_ENGAGEMENT',
  leads_call:            'OUTCOME_LEADS',
  awareness:             'OUTCOME_AWARENESS',
  leads:                 'OUTCOME_LEADS',
  sales:                 'OUTCOME_SALES',
  app_promotion:         'OUTCOME_APP_PROMOTION',
}

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
    copyTone: '전화 한 통의 가치 강조·"바로 연결됩니다"·통화 시간 안내',
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

export const GOAL_RESULT: Record<ObjectivePhase1Id, { noun: string; costLabel: string }> = {
  awareness:             { noun: '노출',          costLabel: 'CPM' },
  traffic:               { noun: '클릭',          costLabel: 'CPC' },
  traffic_page_visit:    { noun: '페이지 방문',   costLabel: '페이지 방문당 비용' },
  engagement:            { noun: '참여',          costLabel: '참여당 비용' },
  engagement_page_likes: { noun: '페이지 좋아요', costLabel: '좋아요당 비용' },
  engagement_messages:   { noun: '대화',          costLabel: '대화당 비용' },
  leads_call:            { noun: '통화',          costLabel: '통화당 비용' },
}
