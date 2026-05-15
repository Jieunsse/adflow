export const TONES = [
  { id: 'warm' as const, label: '감성적·따뜻하게', promptDesc: '감성적이고 따뜻한 톤' },
  { id: 'pro' as const, label: '전문적·신뢰감 있게', promptDesc: '전문적이고 신뢰감 있는 톤' },
  { id: 'trendy' as const, label: '트렌디·발랄하게', promptDesc: '트렌디하고 발랄한 톤' },
] as const

// Meta CTA 버튼 타입 — label은 Meta가 한국어로 실제 표시하는 문구예요.
export const CTAS = [
  { id: 'buy'    as const, label: '지금 구매하기' },   // SHOP_NOW
  { id: 'learn'  as const, label: '자세히 알아보기' }, // LEARN_MORE
  { id: 'sample' as const, label: '혜택 받기' },       // GET_OFFER
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
  buy:    '지금 구매하기',
  learn:  '자세히 알아보기',
  sample: '혜택 받기',
}

export const CTA_META_TYPE: Record<CtaId, string> = {
  buy: 'SHOP_NOW',
  learn: 'LEARN_MORE',
  sample: 'GET_OFFER',
}

// 아웃컴 칩 선택 시 자동으로 결정되는 CTA — 유저가 직접 고르지 않아요.
export const OUTCOME_TO_CTA: Record<string, CtaId> = {
  traffic:       'learn', // LEARN_MORE — 사이트 방문 유도
  engagement:    'learn', // LEARN_MORE — 게시물 반응
  awareness:     'learn', // LEARN_MORE — 인지도
  leads:         'buy',   // SHOP_NOW  — 가입자 확보 (Phase 2)
  sales:         'buy',   // SHOP_NOW  — 매출 향상 (Phase 2)
  app_promotion: 'buy',   // SHOP_NOW  — 앱 설치 (Phase 2)
}

export const IMAGE_ART: Record<ImageId, string> = {
  img1: 'art-cyan',
  img2: 'art-lavender',
  img3: 'art-warmgreen',
}

export const OBJECTIVES_PHASE1 = [
  { id: 'traffic'    as const, metaObjective: 'OUTCOME_TRAFFIC'    as const, label: '트래픽',  outcomeLabel: '사이트 방문 유도',    copyTone: '클릭 유도·urgency·명확한 CTA 강조' },
  { id: 'engagement' as const, metaObjective: 'OUTCOME_ENGAGEMENT' as const, label: '참여',    outcomeLabel: '게시물 반응 키우기',  copyTone: '공감·질문 던지기·대화형, 댓글/공유를 유도' },
  { id: 'awareness'  as const, metaObjective: 'OUTCOME_AWARENESS'  as const, label: '인지도',  outcomeLabel: '인지도 넓히기',       copyTone: '브랜드 약속·메모러블·짧고 강한 헤드라인, 첫 노출 인상 위주' },
] as const

export const OBJECTIVES_PHASE2 = [
  { id: 'leads'         as const, metaObjective: 'OUTCOME_LEADS'          as const, label: '잠재고객', outcomeLabel: '가입자 확보',  copyTone: '가입 유도·리드 폼 강조·개인정보 신뢰 강조' },
  { id: 'sales'         as const, metaObjective: 'OUTCOME_SALES'          as const, label: '판매',     outcomeLabel: '매출 향상',    copyTone: '구매 전환·가격 혜택·사회적 증거 강조' },
  { id: 'app_promotion' as const, metaObjective: 'OUTCOME_APP_PROMOTION'  as const, label: '앱 홍보',  outcomeLabel: '앱 설치 유도', copyTone: '앱 설치 유도·핵심 기능 소개·간편함 강조' },
] as const

export const OBJECTIVES_ALL = [...OBJECTIVES_PHASE1, ...OBJECTIVES_PHASE2] as const

export type ObjectivePhase1Id = (typeof OBJECTIVES_PHASE1)[number]['id']
export type ObjectivePhase2Id = (typeof OBJECTIVES_PHASE2)[number]['id']
export type ObjectiveId = ObjectivePhase1Id | ObjectivePhase2Id
export type MetaObjective = (typeof OBJECTIVES_ALL)[number]['metaObjective']

export function findObjective(id: ObjectiveId) {
  return OBJECTIVES_ALL.find((o) => o.id === id)!
}
