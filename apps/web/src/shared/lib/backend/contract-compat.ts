// 와이어 형태 동결의 강제 장치. 런타임 코드가 없고 타입 단언만 있다.
//
// Spring 이 내는 스키마(생성 타입)를 프론트 도메인 타입에 대입해본다. 백엔드가 필드를
// 빠뜨리거나 타입을 바꾸면 tsc 가 여기서 깨진다 — 화면에서 undefined 를 만나기 전에.
//
// 방향에 주의: "생성 → 도메인" 이다. 응답을 도메인 타입 자리에 안전하게 쓸 수 있는가를 본다.

import type { components } from "@adflow/contracts/types/api";
import type { BrandProfileEntry } from "@features/brand-profile/model/useBrandProfileStorage";
import type { Creator } from "@entities/creator/model";
import type { InfluencerCampaign } from "@entities/influencer-campaign/model";
import type { LibraryItem } from "@shared/lib/library";
import type { AutoRelaunchEntry } from "@shared/lib/autoRelaunch";
import type { LaunchedCampaign } from "@entities/campaign/model";
import type { PersonaEntry } from "@features/brand-profile/model/usePersonasStorage";
import type { ProductEntry } from "@shared/lib/products";
import type { ReferenceMaterial } from "@shared/lib/referenceMaterials";
import type {
  Tournament as TournamentEntity,
  TourRound as TourRoundEntity,
  TournamentDelivery,
  TourEnvelope,
  TourVariant,
} from "@entities/ab-test/tournament/engine";

type Api<K extends keyof components["schemas"]> = components["schemas"][K];

type Assert<T extends true> = T;
type AssignableTo<From, To> = [From] extends [To] ? true : false;

export type LibraryItemIsCompatible = Assert<AssignableTo<Api<"LibraryItem">, LibraryItem>>;
export type CreatorIsCompatible = Assert<AssignableTo<Api<"Creator">, Creator>>;
export type CampaignIsCompatible = Assert<
  AssignableTo<Api<"InfluencerCampaign">, InfluencerCampaign>
>;

// policy 만 예외다. SopSection 은 type 마다 data 형태가 달라지는 판별 유니온이고, 서버는 그 값을
// 해석하지 않고 JSON 텍스트로 왕복시키기만 한다(설계 문서 대비 의도된 편차 #1). OpenAPI 로 그
// 유니온을 표현할 수 없으므로 계약이 지켜주지 못하는 유일한 필드다.
//
// 대신 policy 를 뺀 나머지 전 필드는 여기서 검증된다. policy 의 왕복 자체는
// BrandProfileControllerTest.판별유니온_policy_가_배열로_왕복한다 와
// BrandProfilePostgresIT.판별유니온_policy_가_텍스트로_왕복한다 가 런타임으로 지킨다.
export type BrandProfileIsCompatible = Assert<
  AssignableTo<Omit<Api<"BrandProfile">, "policy">, Omit<BrandProfileEntry, "policy">>
>;

// 단계 3 — 승격된 4종.
export type PersonaIsCompatible = Assert<AssignableTo<Api<"Persona">, PersonaEntry>>;
export type AutoRelaunchIsCompatible = Assert<
  AssignableTo<Api<"AutoRelaunchState">, AutoRelaunchEntry>
>;

// 게재 영수증은 계약이 지켜주지 못하는 필드가 넷이다.
//   adIds          — TS 튜플 [string, string]. springdoc 이 prefixItems 를 내지 않는다.
//   abTestVariantB — 판별 유니온.
//   goalId         — const 배열에서 파생된 유니온. Java 로 옮기면 목록이 두 곳에 살아 드리프트한다.
// quickStart      — 프론트가 해석하는 재사용 설정 JSON.
// 넷의 왕복은 CampaignLaunchControllerTest·CampaignLaunchPostgresIT 가 런타임으로 지킨다.
type LaunchOpaque = "adIds" | "abTestVariantB" | "goalId" | "quickStart";
export type CampaignLaunchIsCompatible = Assert<
  AssignableTo<Omit<Api<"CampaignLaunch">, LaunchOpaque>, Omit<LaunchedCampaign, LaunchOpaque>>
>;

// 단계 4 — 나머지 테이블.
//
// 주의: imageUrl·storageUrl 은 양쪽 다 string 이지만 의미가 다르다. 서버는 버킷 상대 경로를
// 담고(product-images/{bp}/{id}.png) Next 라우트가 /api/files/… 로 조립해 내려보낸다.
// 컴파일러가 이 차이를 못 보므로 files.test.ts 의 조립·역조립 왕복 테스트가 대신 지킨다.
export type ProductIsCompatible = Assert<AssignableTo<Api<"Product">, ProductEntry>>;

// type 만 예외다. TS 는 "image"|"pdf"|"txt" 유니온인데 서버는 String 으로 둔다 — Java enum 으로
// 옮기면 목록이 두 곳에 살아 드리프트한다(단계 3 의 goalId 와 같은 판단). 값의 왕복은
// ReferenceMaterialControllerTest.스칼라가_그대로_왕복한다 가 런타임으로 지킨다.
export type ReferenceMaterialIsCompatible = Assert<
  AssignableTo<Omit<Api<"ReferenceMaterial">, "type">, Omit<ReferenceMaterial, "type">>
>;

// 단계 5 — 토너먼트 애그리거트. 29필드 + 중첩 6종이라 이 단언이 잡아주는 범위가 가장 넓다.
//
// 문자열 유니온은 계약이 못 지킨다. Java 로 enum 을 옮기면 목록이 두 곳에 살아 드리프트하므로
// String 으로 두는 쪽을 택했다(단계 3 의 goalId·단계 4 의 ReferenceMaterial.type 과 같은 판단).
// 값의 정확성은 골든 픽스처와 컨트롤러 왕복 테스트가 런타임으로 지킨다.
type TourOpaque =
  | "mode" | "status" | "championSource" | "variationIntensity" | "completionReason"
  // rounds·pendingHypothesis 는 안쪽이 다시 유니온·튜플이라 통째로 뺀다(아래 TourRound 단언 참고).
  | "rounds" | "pendingHypothesis";
export type TournamentIsCompatible = Assert<
  AssignableTo<Omit<Api<"Tournament">, TourOpaque>, Omit<TournamentEntity, TourOpaque>>
>;

// 라운드도 같은 이유로 유니온·튜플이 예외다.
//   axis·rawWinner·status  — 문자열 유니온
//   adIds·adSetIds·adKpis  — TS 튜플 [T, T]. springdoc 이 prefixItems 를 내지 않는다
//   verdict·hypothesis     — 안쪽이 다시 유니온이라 통째로 뺀다
type RoundOpaque =
  | "axis" | "rawWinner" | "status" | "adIds" | "adSetIds" | "adKpis" | "verdict" | "hypothesis";
export type TourRoundIsCompatible = Assert<
  AssignableTo<Omit<Api<"TourRound">, RoundOpaque>, Omit<TourRoundEntity, RoundOpaque>>
>;

// 게재 봉투는 유니온이 없어 전 필드가 지켜진다 — 장기 토큰이 든 곳이라 여기가 가장 엄격해야 한다.
export type TournamentDeliveryIsCompatible = Assert<
  AssignableTo<Api<"TournamentDelivery">, TournamentDelivery>
>;

// 봉투·변형도 전 필드 검증된다.
export type TourEnvelopeIsCompatible = Assert<AssignableTo<Api<"Envelope">, TourEnvelope>>;
export type TourVariantIsCompatible = Assert<AssignableTo<Api<"Variant">, TourVariant>>;
