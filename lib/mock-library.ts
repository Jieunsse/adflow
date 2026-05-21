import type { LibraryItem } from "@shared/lib/library";

// 둘러보기 모드용 소재 라이브러리 데모. mock-campaigns 의 브랜드 어휘와 톤을 맞췄어요.
// savedAt 은 호출 시점 기준 상대 시간(분/일 전)으로 계산해 "방금 전" 같은 표시가 자연스럽게 나오게 함.
const DAY = 86400000;
const HOUR = 3600000;

export function getMockLibraryItems(now: number = Date.now()): LibraryItem[] {
  return [
    {
      id: "cre_demo_tropical",
      savedAt: now - 2 * HOUR,
      brand: "AdFlow 카페",
      headline: "여름엔 트로피컬 아이스티 한 잔",
      primary:
        "푹푹 찌는 오후, 망고와 패션후르츠가 한 모금에 터지는 여름 한정 트로피컬 아이스티.\n매장에서 바로 만들어 더 시원하게 즐겨보세요.",
      tone: "trendy",
      toneLabel: "트렌디",
      ctaId: "SHOP_NOW",
      ctaLabel: "지금 구매",
      goal: "트래픽",
      target: "20–34세 · 카페 자주 가는 사람",
      gradient: "linear-gradient(135deg, #ff7a59 0%, #ffb24d 55%, #ffd966 100%)",
      tag: "AI 생성",
    },
    {
      id: "cre_demo_coldbrew",
      savedAt: now - 1 * DAY,
      brand: "AdFlow 카페",
      headline: "콜드브루 오리지널, 깊고 단단하게",
      primary:
        "14시간 저온 추출로 끌어낸 묵직한 바디. 신상 콜드브루 오리지널, 첫 잔은 매장에서 무료로 만나보세요.",
      tone: "pro",
      toneLabel: "전문적",
      ctaId: "LEARN_MORE",
      ctaLabel: "자세히 보기",
      goal: "인지도",
      target: "25–44세 · 직장인 · 커피 마니아",
      gradient: "linear-gradient(135deg, #2c3e50 0%, #4a5d6f 60%, #6e8aa6 100%)",
      tag: "AI 생성",
    },
    {
      id: "cre_demo_energy",
      savedAt: now - 2 * DAY,
      brand: "AdFlow 카페",
      headline: "공부할 땐, 에너지 패키지",
      primary:
        "콜드브루 + 단백질 쿠키 + 미네랄 워터까지. 수험생 응원 패키지로 오늘 한 챕터 더 정복해요.",
      tone: "warm",
      toneLabel: "감성적",
      ctaId: "SHOP_NOW",
      ctaLabel: "지금 구매",
      goal: "참여",
      target: "18–24세 · 수험생·대학생",
      gradient: "linear-gradient(135deg, #6541f2 0%, #c2185b 60%, #ff7a59 100%)",
      tag: "AI 생성",
    },
    {
      id: "cre_demo_parents",
      savedAt: now - 4 * DAY,
      brand: "AdFlow 카페",
      headline: "부모님께 드리는 따뜻한 한 잔",
      primary:
        "어버이날 한정, 핸드드립 원두와 디저트가 함께 담긴 감사 패키지. 마음을 가장 부드럽게 전하는 방법.",
      tone: "warm",
      toneLabel: "감성적",
      ctaId: "ORDER_NOW",
      ctaLabel: "주문하기",
      goal: "트래픽",
      target: "30–54세 · 가족 단위 소비자",
      gradient: "linear-gradient(135deg, #0066ff 0%, #6541f2 60%, #00bdde 100%)",
      tag: "AI 생성",
    },
    {
      id: "cre_demo_lavender",
      savedAt: now - 6 * DAY,
      brand: "AdFlow 카페",
      headline: "봄을 닮은 보라, 라벤더 라떼",
      primary:
        "은은한 라벤더 향과 부드러운 우유 거품이 만나는 봄 시즌 한정 음료. 사진 한 장으로도 봄이 와요.",
      tone: "trendy",
      toneLabel: "트렌디",
      ctaId: "LEARN_MORE",
      ctaLabel: "자세히 보기",
      goal: "참여",
      target: "20–34세 · 인스타그램 자주 사용",
      gradient: "linear-gradient(135deg, #6541f2 0%, #c2185b 60%, #ff7a59 100%)",
      tag: "AI 생성",
    },
    {
      id: "cre_demo_membership",
      savedAt: now - 9 * DAY,
      brand: "AdFlow 카페",
      headline: "멤버십 한 번, 한 달이 달라져요",
      primary:
        "매일 한 잔 무료 리필 + 디저트 20% 할인. 첫 달 9,900원으로 단골이 되는 가장 쉬운 방법.",
      tone: "pro",
      toneLabel: "전문적",
      ctaId: "SIGN_UP",
      ctaLabel: "가입하기",
      goal: "트래픽",
      target: "25–44세 · 카페 주 3회 이상",
      gradient: "linear-gradient(135deg, #0066ff 0%, #6541f2 60%, #00bdde 100%)",
      tag: "AI 생성",
    },
  ];
}
