// 둘러보기 모드 카피 시드 — ADR-033 시연 레이어.
// 둘러보기는 백엔드에 닿지 않는다. `/api/generate-creative` 대신 미리 써 둔 그린루틴 카피를 돌려준다.
// 응답 모양은 실제 API(GenerateCreativeResult)와 같아서 호출부는 분기 하나만 두면 된다.
//
// 문구는 광고 목표(metaObjective)별로 3안, 각 안이 그 목표의 추천 훅(recommendedHooks) 순서와 짝을 이룬다.
// 그래서 목표를 바꾸면 3안도 같이 바뀌고, VER 배지의 훅 라벨과 실제 카피 성격이 어긋나지 않는다.
// 데모 브랜드 정책(seed-demo.ts)의 금칙어·필수 문구를 지켜 썼다.

import type { GenerateCreativeParams, GenerateCreativeResult, CreativeAttribution } from "@/lib/gemini-creative";
import { findObjective, recommendedHooks, type CopyHook, type MetaObjective, type ObjectiveId } from "../options";
import type { RefineId } from "../refine-presets";

type Variant = { headline: string; subtitle: string; primaryText: string };

const ENGAGEMENT: [Variant, Variant, Variant] = [
  {
    headline: "요즘 화장대에 다 있다는 그거",
    subtitle: "비건 스킨케어 입문템",
    primaryText:
      "요즘 피드에 자꾸 보이던 그 초록 크림, 그린루틴이에요 🌿\n화학 첨가물 없이 식물 유래 성분만 담아서 민감한 날에도 편하게 발려요.\n비건 인증 받은 무향·무색소 포뮬러라 향에 예민해도 괜찮아요.\n팔로우해두면 신상 소식을 가장 먼저 받아보실 수 있어요.",
  },
  {
    headline: "저희도 피부가 뒤집혀서 시작했어요",
    subtitle: "성분표를 3년 읽었어요",
    primaryText:
      "화장품을 바꿀 때마다 붉어지는 피부 때문에 성분표만 3년을 읽었어요.\n그러다 남긴 건 딱 필요한 식물 유래 성분뿐. 무향·무색소로 자극이 될 만한 건 다 뺐고요.\n리뷰 평점 4.8/5 (2,400+건)이 그 시간을 대신 말해줘요.\n같은 고민이라면 팔로우해두고 천천히 지켜봐 주세요.",
  },
  {
    headline: "성분이 순하면 안 발린다는 편견",
    subtitle: "생각보다 촉촉해요",
    primaryText:
      "순한 제품은 겉돈다는 말, 저희도 그렇게 알고 있었어요 👀\n그런데 발라보면 몇 초 만에 스며들고 저녁까지 당김이 없어요.\nEWG 그린 등급 전성분에 비건 인증까지 받은 무향·무색소 크림이거든요.\n궁금하시면 팔로우하고 후기부터 구경해보세요.",
  },
];

const TRAFFIC: [Variant, Variant, Variant] = [
  {
    headline: "재구매율 38%가 말해주는 것",
    subtitle: "숫자로 보는 그린루틴",
    primaryText:
      "누적 판매 12만 개, 재구매율 38%.\n한 번 써본 분들이 다시 담는 이유는 단순해요 — 자극이 없어서요.\nEWG 그린 등급 전성분에 무향·무색소, 비건 인증까지 받았거든요.\n성분표 전체는 사이트에서 확인해보실 수 있어요.",
  },
  {
    headline: "성분표를 먼저 보여드릴게요",
    subtitle: "숨길 게 없어서요",
    primaryText:
      "‘순하다’는 말만으로는 부족하다고 생각했어요.\n그래서 EWG 그린 등급 전성분을 전부 공개하고, 비건 인증(한국비건인증원)도 받았어요.\n무향·무색소라 향에 예민한 분들도 편하게 쓰실 수 있어요.\n어떤 성분이 들어갔는지 사이트에서 직접 확인해보세요.",
  },
  {
    headline: "아침에 5분이 줄어요",
    subtitle: "한 통이면 정리돼요",
    primaryText:
      "토너, 세럼, 크림… 단계가 늘수록 아침이 바빠지죠.\n그린루틴 수분 크림 하나면 세수 후 바로 마무리돼요.\n식물 유래 성분에 무향·무색소, 비건 인증까지 받아 민감한 날에도 그대로 써요.\n사용법과 성분은 사이트에 정리해뒀어요.",
  },
];

const AWARENESS: [Variant, Variant, Variant] = [
  {
    headline: "화장품 회사가 성분표부터 꺼내는 이유",
    subtitle: "가릴 게 없어서요",
    primaryText:
      "보통은 예쁜 사진부터 보여드리는데, 저희는 성분표를 먼저 꺼내요 👀\nEWG 그린 등급 전성분에 무향·무색소, 그리고 비건 인증까지.\n민감해서 화장품 바꾸기가 무서웠던 분들을 위해 만든 크림이거든요.\n그린루틴, 이름부터 기억해주세요.",
  },
  {
    headline: "3년 동안 성분표만 읽었어요",
    subtitle: "그래서 남은 건 이것뿐",
    primaryText:
      "바를 때마다 붉어지던 피부 때문에 시작한 브랜드예요.\n좋다는 성분을 더하는 대신, 자극이 될 만한 걸 하나씩 뺐어요.\n남은 건 식물 유래 수분 성분과 무향·무색소, 그리고 비건 인증.\n그린루틴은 그렇게 만들어졌어요.",
  },
  {
    headline: "더한 게 아니라 뺀 크림",
    subtitle: "덜어내는 스킨케어",
    primaryText:
      "향도, 색소도, 굳이 필요 없는 건 넣지 않았어요.\n남긴 건 피부가 필요로 하는 식물 유래 수분 성분뿐이에요.\nEWG 그린 등급 전성분에 비건 인증까지 받은 이유고요.\n덜어내는 스킨케어, 그린루틴이에요.",
  },
];

const LEADS: [Variant, Variant, Variant] = [
  {
    headline: "내 피부에 맞을지 먼저 물어보세요",
    subtitle: "상담부터 편하게",
    primaryText:
      "민감한 피부일수록 아무거나 바르기 어렵죠.\n어떤 성분이 맞고 안 맞는지 전화로 편하게 여쭤보세요.\n비건 인증(한국비건인증원)과 EWG 그린 등급 전성분 자료도 그대로 안내해드려요.\n무향·무색소라 향 때문에 고민이셨던 분들도 환영이에요.",
  },
  {
    headline: "2,400건 넘는 후기, 그래도 궁금하다면",
    subtitle: "피부는 사람마다 달라요",
    primaryText:
      "리뷰 평점 4.8/5 (2,400+건), 재구매율 38%.\n숫자는 이렇지만 피부는 사람마다 다르니까요.\n지금 쓰는 제품과 함께 써도 되는지 전화로 확인해보세요.\n비건 인증 받은 무향·무색소 제품이라 성분 안내도 어렵지 않아요.",
  },
  {
    headline: "고민만 하다 계절이 바뀌었다면",
    subtitle: "통화 5분이면 돼요",
    primaryText:
      "어떤 걸 골라야 할지 몰라 미루다 건조한 계절이 또 왔죠.\n피부 상태만 알려주시면 필요한 것만 골라드릴게요.\n식물 유래 성분에 무향·무색소, 비건 인증까지 받은 제품이라 부담 없이 시작하실 수 있어요.\n통화는 5분이면 충분해요.",
  },
];

// Phase 1 칩 8개는 이 4개 그룹으로 모인다. 나머지(SALES·APP_PROMOTION)는 TRAFFIC 문구로 폴백.
const BY_OBJECTIVE: Partial<Record<MetaObjective, [Variant, Variant, Variant]>> = {
  OUTCOME_ENGAGEMENT: ENGAGEMENT,
  OUTCOME_TRAFFIC: TRAFFIC,
  OUTCOME_AWARENESS: AWARENESS,
  OUTCOME_LEADS: LEADS,
};

export function browseVariants(outcome: ObjectiveId): [Variant, Variant, Variant] {
  return BY_OBJECTIVE[findObjective(outcome).metaObjective] ?? TRAFFIC;
}

// 서버 deriveInjected(lib/gemini-creative.ts) 와 같은 규칙 — "프롬프트에 넣은 재료"만 센다.
// 둘러보기는 프롬프트를 안 만들지만, 같은 재료가 준비돼 있었다는 사실은 그대로다.
function injectedFrom(params: GenerateCreativeParams): CreativeAttribution["injected"] {
  const bp = params.brandProfile;
  const out: CreativeAttribution["injected"] = [];
  if (params.tone?.trim()) out.push("tone");
  if (bp?.brandVoice?.trim()) out.push("brandVoice");
  if (bp?.customerVoiceSummary?.trim()) out.push("customerVoice");
  if (params.persona) out.push("persona");
  if (params.product) out.push("product");
  if (bp?.copyReferences?.some((t) => t.trim())) out.push("copyReferences");
  return out;
}

/** 본문이 브랜드 근거 문구를 실제로 담고 있는지 — 추측하지 않고 문자열로 확인한다. */
function citesProof(body: string, proofPoints: string[] | undefined): boolean {
  return (proofPoints ?? []).some((t) => t.trim() && body.includes(t.trim()));
}

/** `/api/generate-creative` 와 같은 입력·같은 출력. 호출부는 이 함수로 갈아끼우기만 하면 된다. */
export function browseCreative(params: GenerateCreativeParams): GenerateCreativeResult {
  const v = browseVariants(params.outcome);
  const hooks: [CopyHook, CopyHook, CopyHook] =
    params.hooks && params.hooks.length === 3
      ? [params.hooks[0], params.hooks[1], params.hooks[2]]
      : recommendedHooks(params.outcome);
  const proofPoints = params.brandProfile?.proofPoints;
  const cited: [boolean, boolean, boolean] = [
    citesProof(v[0].primaryText, proofPoints),
    citesProof(v[1].primaryText, proofPoints),
    citesProof(v[2].primaryText, proofPoints),
  ];

  return {
    headlines: [v[0].headline, v[1].headline, v[2].headline],
    subtitles: [v[0].subtitle, v[1].subtitle, v[2].subtitle],
    primaryTexts: [v[0].primaryText, v[1].primaryText, v[2].primaryText],
    // 그린루틴 주 고객층. 페르소나를 골랐으면 호출부의 mergePersonaTargeting 이 이 위에 덮어쓴다.
    targeting: { ageMin: 20, ageMax: 34, genders: [2] },
    hooks,
    proofPointsCited: cited,
    attribution: {
      reflected: cited.some(Boolean) ? ["proofPoints"] : [],
      injected: injectedFrom(params),
    },
  };
}

// ── "AI로 고치기"(시안 2b) 둘러보기 판 ─────────────────────────────────────────
// 미리 써 둔 다른 본문으로 통째로 갈아끼우면 방금 고른 안과 관계가 끊긴다.
// 그래서 화면에 있는 본문을 그대로 받아 라벨이 말하는 방향으로만 고친다 — 전부 결정적이라 시연이 재현된다.

const SOFT_CLOSER = "부담 없이 천천히 살펴보셔도 괜찮아요.";

/** 숫자가 든 근거 문구를 하나 고른다. 없으면 null. */
function numericProof(proofPoints: string[] | undefined): string | null {
  return (proofPoints ?? []).find((t) => /\d/.test(t)) ?? null;
}

export function browseRefinedBody(
  body: string,
  id: RefineId,
  ctx: { proofPoints?: string[]; ctaLabel?: string },
): string {
  const lines = body.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return body;

  switch (id) {
    case "shorter":
      // 줄이 여러 개면 앞 두 줄, 한 줄뿐이면 앞 두 문장.
      if (lines.length > 2) return lines.slice(0, 2).join("\n");
      return (lines[0].match(/[^.!?]+[.!?]+/g) ?? [lines[0]]).slice(0, 2).join("").trim();

    case "softer": {
      const softened = lines.map((l) => l.replace(/!/g, "."));
      const last = softened.length - 1;
      softened[last] = softened[last].replace(/세요([.!?]?)$/, "셔도 좋아요$1");
      const out = softened.join("\n");
      // 눅일 느낌표도 명령형도 없던 본문은 그대로 남는다 — 버튼이 아무 일도 안 한 것처럼 보이지 않게
      // 여지를 주는 한 줄을 더한다.
      if (out !== lines.join("\n") || out.includes(SOFT_CLOSER)) return out;
      return `${out}\n${SOFT_CLOSER}`;
    }

    case "numbers": {
      const proof = numericProof(ctx.proofPoints);
      if (!proof || body.includes(proof)) return body;
      return [`${proof}.`, ...lines].join("\n");
    }

    case "cta": {
      const line = `${ctx.ctaLabel?.trim() || "자세히 알아보기"}, 지금 확인해보세요.`;
      if (body.includes(line)) return body;
      return [...lines, line].join("\n");
    }
  }
}
