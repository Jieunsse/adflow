import { profilesSnapshot, replaceProfiles } from "./brandProfileStore";
import type { BrandProfileEntry } from "./useBrandProfileStorage";
import type { PersonaEntry } from "./usePersonasStorage";
import type { ReferenceMaterial } from "@shared/lib/referenceMaterials";
import type { ProductEntry } from "@shared/lib/products";

const DEMO_PROFILE_ID = "demo-greenroutine-001";

const DEMO_PROFILE: BrandProfileEntry = {
  id: DEMO_PROFILE_ID,
  name: "그린루틴 — 비건 스킨케어",
  isDefault: true,
  tone: "친근하고 감성적으로",
  marginRate: 0.3,
  brandDescription:
    "20~35세 여성을 위한 비건 스킨케어 브랜드 '그린루틴'. 대표 제품은 수분 크림과 토너로, 화학 첨가물 없이 식물성 성분만 사용해요. 민감성 피부도 안심하고 쓸 수 있는 게 강점이에요.",
  brandVoice: "친근하고 솔직하게. 과장 없이 담백하게. 고객과 대화하듯 말해요.",
  customerVoiceSummary:
    "'바르고 나면 촉촉해요', '향이 자극적이지 않아서 좋아요', '민감한 피부인데 전혀 자극 없어요' 같은 리뷰가 많아요.",
  imageGuide:
    "자연광 느낌의 밝고 깨끗한 톤. 배경은 흰색 또는 연한 베이지. 로고는 우측 하단. 인물이 나오는 경우 미소 짓는 자연스러운 표정.",
  proofPoints: [
    "재구매율 38%",
    "누적 판매 12만 개",
    "리뷰 평점 4.8/5 (2,400+건)",
    "비건 인증(한국비건인증원)",
    "2024 올리브영 어워즈 스킨케어 부문 수상",
    "EWG 그린 등급 전성분",
  ],
  copyReferences: [
    {
      id: "demo-copyref-001",
      text: "민감한 피부에도 순하게, 매일 쓰는 비건 루틴.",
      source: "manual",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    },
    {
      id: "demo-copyref-002",
      text: "오늘도 촉촉하게. 그린루틴 수분 크림 한 통이면 충분해요.",
      source: "ig",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    },
    {
      id: "demo-copyref-003",
      text: "향은 은은하게, 자극은 없이. 무향·무색소 비건 스킨케어.",
      source: "ig",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    },
  ],
  policy: [
    {
      type: "prohibited_words",
      source: "user",
      data: { words: ["최고", "1위", "완벽", "100% 보장", "피부과 인증", "부작용 없음"] },
    },
    {
      type: "required_phrases",
      source: "user",
      data: { phrases: ["비건 인증", "무향·무색소"] },
    },
    {
      type: "required_hashtags",
      source: "user",
      data: { hashtags: ["#그린루틴", "#비건스킨케어", "#민감성피부"] },
    },
    {
      type: "image_restrictions",
      source: "user",
      data: {
        text: "이미지 최소 해상도 1080×1080px\n피드 이미지 내 텍스트 비율 20% 이하\n릴스는 9:16 비율 필수",
      },
    },
    {
      type: "length_limits",
      source: "user",
      data: { headline: 40, body: 125, hashtagCount: 5 },
    },
    {
      type: "cta_restrictions",
      source: "user",
      data: {
        blacklist: ["지금 바로 구매", "클릭하세요", "무조건 최저가"],
        note: "강요성 표현 금지. '확인해보세요' 형태 권장.",
      },
    },
    {
      type: "industry_regulations",
      source: "user",
      data: {
        text: "화장품법 제13조 준수. '의약품 효능' 암시 표현 금지.\n예: '여드름 치료', '아토피 완화' 사용 불가.\n식품의약품안전처 기능성 화장품 고시 원료 외 효능 주장 금지.",
      },
    },
    {
      type: "competitor_policy",
      source: "user",
      data: {
        text: "경쟁사 브랜드명·제품명 직접 언급 금지.\n'타사 대비' 비교 표현 삼가요.\n비교 광고 집행 시 객관적 근거 자료 보유 필수.",
      },
    },
    {
      type: "pricing_rules",
      source: "user",
      data: {
        text: "정가 표시 없이 할인율만 표기 금지. '최대 50% 할인' 류 표현은 실제 정가 표시 병행 필수.\n배송비 포함 여부 명시.",
      },
    },
    {
      type: "audience_restrictions",
      source: "user",
      data: {
        text: "만 18세 미만 타겟 광고 금지.\n임산부·수유부 대상 효능 주장 금지.\n특정 질환(아토피·여드름 등) 유발·치료 암시 표현 금지.",
      },
    },
    {
      type: "platform_rules",
      source: "user",
      data: {
        text: "Instagram: 이미지 내 텍스트 20% 이하. 릴스는 9:16 비율 권장.\nFacebook: 동영상 자동재생 광고 시 무음 상태에서도 내용 전달 가능해야 함.\n피드 이미지 최소 1080×1080px.",
      },
    },
  ],
};

const DEMO_PERSONAS: PersonaEntry[] = [
  {
    id: "demo-persona-001",
    brandProfileId: DEMO_PROFILE_ID,
    name: "20대 여성 대학생",
    ageMin: 20,
    ageMax: 27,
    genders: [2],
    location: ["서울", "경기"],
    interests: ["스킨케어", "비건라이프", "뷰티유튜브"],
    customerDescription:
      "20대 초중반 직장인·대학생. 처음으로 피부 관리를 시작하는 시점. 성분은 잘 모르지만 '자연성분', '무자극'에 반응해요. 가성비를 중시하고 인스타그램 릴스로 제품 정보를 얻어요.",
  },
  {
    id: "demo-persona-002",
    brandProfileId: DEMO_PROFILE_ID,
    name: "30대 여성 직장인",
    ageMin: 28,
    ageMax: 38,
    genders: [2],
    location: ["서울", "부산", "대구"],
    interests: ["화장품 성분", "더마코스메틱", "지속가능소비"],
    customerDescription:
      "30대 직장인. EWG 그린 등급, 성분표를 꼼꼼히 체크해요. 비건 인증과 환경 가치에 높은 관심. 네이버 블로그와 유튜브 성분 분석 영상을 참고해 구매 결정. 가격보다 가치를 우선해요.",
  },
];

// data URL: 연한 그린 배경 40×40 SVG placeholder (이미지 썸네일용)
const IMG_PLACEHOLDER =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZThmNGU4Ii8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZvbnQtc2l6ZT0iMTYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzZXJpZiIgZmlsbD0iIzVhOGE1YSI+8J+MfTwvdGV4dD48L3N2Zz4=";

const DEMO_MATERIALS: ReferenceMaterial[] = [
  {
    id: "demo-ref-001",
    brandProfileId: DEMO_PROFILE_ID,
    name: "그린루틴 브랜드 가이드라인.txt",
    type: "txt",
    mimeType: "text/plain",
    sizeBytes: 1842,
    storageUrl: "",
    uploadedAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
  },
  {
    id: "demo-ref-002",
    brandProfileId: DEMO_PROFILE_ID,
    name: "2024 봄여름 제품 카탈로그.pdf",
    type: "pdf",
    mimeType: "application/pdf",
    sizeBytes: 3_241_920,
    storageUrl: "",
    uploadedAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
  },
  {
    id: "demo-ref-003",
    brandProfileId: DEMO_PROFILE_ID,
    name: "수분크림 비주얼 소재 봄캠페인.jpg",
    type: "image",
    mimeType: "image/jpeg",
    sizeBytes: 512_000,
    storageUrl: IMG_PLACEHOLDER,
    uploadedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
];

// 둘러보기 모드 제품 목업 — 소재 라이브러리(lib/mock-library.ts)의 그린루틴 제품군과 이미지를 공유한다.
const DEMO_PRODUCTS: ProductEntry[] = [
  {
    id: "demo-product-serum",
    brandProfileId: DEMO_PROFILE_ID,
    name: "식물성 수분 세럼",
    description:
      "화학 첨가물 없이 식물성 수분 성분만 담은 세럼. 한 방울이면 결이 보송하게 정돈돼요. 비건 인증·무향·무색소.",
    imageUrl: "/demo/library/serum.jpg",
    price: "29,000원",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
  },
  {
    id: "demo-product-cleanser",
    brandProfileId: DEMO_PROFILE_ID,
    name: "식물성 클렌저",
    description:
      "식물성 거품이 결을 부드럽게 감싸 담백하게 마무리되는 클렌저. 자극적인 향 대신 무향·무색소. 비건 인증.",
    imageUrl: "/demo/library/cleanser.jpg",
    price: "18,000원",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 18,
  },
  {
    id: "demo-product-toner",
    brandProfileId: DEMO_PROFILE_ID,
    name: "식물성 토너",
    description:
      "자극 없이 결을 정돈하는 무향·무색소 토너. 화학 향료 대신 식물성 수분 성분만 담아 담백하게 마무리돼요. 비건 인증.",
    imageUrl: "/demo/library/toner.jpg",
    price: "22,000원",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 16,
  },
  {
    id: "demo-product-pad",
    brandProfileId: DEMO_PROFILE_ID,
    name: "토너 패드",
    description:
      "패드 한 장이면 결 정돈 끝. 식물성 수분 성분을 그대로 담았어요. 비건 인증·무향·무색소라 예민한 날에도 편하게.",
    imageUrl: "/demo/library/pad.jpg",
    price: "24,000원",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
  },
  {
    id: "demo-product-pack",
    brandProfileId: DEMO_PROFILE_ID,
    name: "수분 시트 팩",
    description:
      "건조하고 예민해지는 날, 식물성 수분 성분을 담은 시트 팩으로 결을 부드럽게 달래줘요. 비건 인증·무향·무색소.",
    imageUrl: "/demo/library/pack.jpg",
    price: "19,000원",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 12,
  },
  {
    id: "demo-product-cream",
    brandProfileId: DEMO_PROFILE_ID,
    name: "수분 크림",
    description:
      "식물성 성분만 담아 바르고 나면 촉촉하게 감기는 무향·무색소 수분 크림. 정기 구독으로 끊김 없이 채울 수도 있어요. 비건 인증.",
    imageUrl: "/demo/library/cream.jpg",
    price: "32,000원",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
  },
  {
    id: "demo-product-suncream",
    brandProfileId: DEMO_PROFILE_ID,
    name: "식물성 선크림",
    description:
      "백탁 없이 산뜻하게 발리는 비건 선크림. 끈적임 없이 가볍게, 무향·무색소로 자극은 줄였어요. 데일리 자외선 차단.",
    imageUrl: "/demo/library/suncream.png",
    price: "26,000원",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 8,
  },
  {
    id: "demo-product-lipbalm",
    brandProfileId: DEMO_PROFILE_ID,
    name: "비건 립밤",
    description:
      "식물성 보습 성분을 담은 비건 립밤. 무향으로 자극 없이, 하루 종일 촉촉하게 발려요. 비건 인증·무색소.",
    imageUrl: "/demo/library/lipbalm.png",
    price: "12,000원",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
  },
  // ADR-050 — A/B 토너먼트 데모(browse_demo_tourn_ample)와 동일 id. /create 에서 이 제품을 고르면
  // 토너먼트가 쌓은 Ledger(trust 입증·rush 반증)가 카피 훅 1단 편향으로 흐르는 걸 시연한다.
  {
    id: "browse_demo_tourn_ample",
    brandProfileId: DEMO_PROFILE_ID,
    name: "비타민 비건 앰플",
    description:
      "식물성 비타민 앰플로 생기 없는 피부에 활력을. 매일 아침 한 방울로 톤을 정돈해요. 비건 인증·무향·무색소.",
    imageUrl: "/demo/library/serum.jpg",
    price: "34,000원",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
  },
];

const PERSONAS_KEY = "adflow:personas";
const PRODUCTS_KEY_PREFIX = "adflow:products:";
const MATERIALS_KEY_PREFIX = "adflow:ref-materials:";
const SEED_VERSION_KEY = "adflow:brand-profiles:seed-version";
// 데모 프로필 스키마가 바뀌면 이 값을 올린다 — 옛 localStorage 의 데모 항목이 한 번 새 시드로 교체된다 (browse/store.ts 패턴).
const SEED_VERSION = "2026-06-04-margin";

export function seedDemoIfEmpty(): void {
  if (typeof window === "undefined") return;
  try {
    // 프로필은 Synced Store(brandProfileStore)가 source-of-truth — 스냅샷 읽고 store 로 쓴다(게스트=로컬만).
    const parsed: BrandProfileEntry[] = profilesSnapshot();
    const versionStale = localStorage.getItem(SEED_VERSION_KEY) !== SEED_VERSION;
    const hasDemo = parsed.some((p) => p.id === DEMO_PROFILE_ID);

    // 빈 상태면 신규 시드. 데모가 이미 있고 시드 버전이 낡았으면 데모 항목만 새 스키마로 교체(사용자 프로필은 보존).
    if (parsed.length > 0 && !(versionStale && hasDemo)) {
      localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
      return;
    }

    const others = parsed.filter((p) => p.id !== DEMO_PROFILE_ID);
    const demoWasDefault = parsed.find((p) => p.id === DEMO_PROFILE_ID)?.isDefault ?? parsed.length === 0;
    replaceProfiles([{ ...DEMO_PROFILE, isDefault: demoWasDefault }, ...others]);
    localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);

    const existingPersonas: PersonaEntry[] = (() => {
      try {
        return JSON.parse(localStorage.getItem(PERSONAS_KEY) ?? "[]") as PersonaEntry[];
      } catch {
        return [];
      }
    })();
    const filtered = existingPersonas.filter((p) => p.brandProfileId !== DEMO_PROFILE_ID);
    localStorage.setItem(PERSONAS_KEY, JSON.stringify([...filtered, ...DEMO_PERSONAS]));

    const productsKey = `${PRODUCTS_KEY_PREFIX}${DEMO_PROFILE_ID}`;
    localStorage.setItem(productsKey, JSON.stringify(DEMO_PRODUCTS));

    const materialsKey = `${MATERIALS_KEY_PREFIX}${DEMO_PROFILE_ID}`;
    localStorage.setItem(materialsKey, JSON.stringify(DEMO_MATERIALS));
  } catch {}
}
