import type {
  SopItemType,
  SopSection,
  LengthLimitsData,
  FreeTextSopType,
} from "./useSopStorage";

export const SOP_SECTION_LABEL: Record<SopItemType, string> = {
  prohibited_words: "금지어 목록",
  length_limits: "길이 제한",
  cta_restrictions: "CTA 제한",
  industry_regulations: "업종 규제",
  competitor_policy: "경쟁사 언급 정책",
  pricing_rules: "가격 표시 규칙",
  audience_restrictions: "타겟 오디언스 제한",
  platform_rules: "플랫폼별 규칙",
};

export const SOP_SECTION_DESCRIPTION: Record<SopItemType, string> = {
  prohibited_words: "광고에 절대 쓰면 안 되는 단어",
  length_limits: "헤드라인·본문·링크 설명·해시태그 개수의 상한",
  cta_restrictions: "쓰면 안 되는 CTA 문구",
  industry_regulations: "업종별 규제·인증·고지 의무",
  competitor_policy: "경쟁사 언급·비교 광고 정책",
  pricing_rules: "가격·할인·정가 표기 규칙",
  audience_restrictions: "연령·지역·관심사 등 타겟팅 제한",
  platform_rules: "플랫폼별 형식·규격·정책",
};

export const SOP_FREETEXT_PLACEHOLDER: Record<SopItemType, string> = {
  prohibited_words: "",
  length_limits: "",
  cta_restrictions: "",
  industry_regulations:
    "한 줄에 한 가지 룰씩 적어주세요.\n예:\n금융·의료·건강기능식품·주류·부동산 업종은 사전 서류 인증 필요\n의약품·도박·담배 광고 집행 불가",
  competitor_policy:
    "한 줄에 한 가지 룰씩 적어주세요.\n예:\n경쟁사 브랜드명·로고·제품명 직접 언급 금지\n비교 광고 집행 시 객관적 근거 자료 보유 필수",
  pricing_rules:
    "한 줄에 한 가지 룰씩 적어주세요.\n예:\n할인율 표시 시 정가와 함께 노출\n'무료' 표현은 부가세·배송비 포함 시에만 사용",
  audience_restrictions:
    "한 줄에 한 가지 룰씩 적어주세요.\n예:\n19세 미만 타겟 금지 (주류·도박)\n특정 종교·정치 성향 타겟팅 금지",
  platform_rules:
    "한 줄에 한 가지 룰씩 적어주세요.\n예:\nInstagram 스토리는 9:16 권장\nFacebook 피드 이미지 내 텍스트는 20% 이하",
};

export const SOP_SECTION_ORDER: SopItemType[] = [
  "prohibited_words",
  "length_limits",
  "cta_restrictions",
  "industry_regulations",
  "competitor_policy",
  "pricing_rules",
  "audience_restrictions",
  "platform_rules",
];

export const SOP_SECTION_PLACEHOLDER: Record<SopItemType, string> = {
  prohibited_words: "한 줄에 단어 하나씩 적어주세요.\n예:\n무조건\n100% 보장\n최저가",
  length_limits:
    "헤드라인: 30\n본문: 100\n링크: 30\n해시태그: 10\n(숫자는 글자 수 / 해시태그는 개수 상한)",
  cta_restrictions: "한 줄에 금지 CTA 하나씩 적어주세요.\n예:\n지금 바로 구매\n무조건 최저가",
  industry_regulations: SOP_FREETEXT_PLACEHOLDER.industry_regulations,
  competitor_policy: SOP_FREETEXT_PLACEHOLDER.competitor_policy,
  pricing_rules: SOP_FREETEXT_PLACEHOLDER.pricing_rules,
  audience_restrictions: SOP_FREETEXT_PLACEHOLDER.audience_restrictions,
  platform_rules: SOP_FREETEXT_PLACEHOLDER.platform_rules,
};

const LENGTH_LIMIT_KEYS: Record<string, keyof LengthLimitsData> = {
  헤드라인: "headline",
  본문: "body",
  링크: "link",
  해시태그: "hashtagCount",
};

export function sectionToText(s: SopSection): string {
  switch (s.type) {
    case "prohibited_words":
      return s.data.words.join("\n");
    case "length_limits": {
      const lines: string[] = [];
      if (s.data.headline != null) lines.push(`헤드라인: ${s.data.headline}`);
      if (s.data.body != null) lines.push(`본문: ${s.data.body}`);
      if (s.data.link != null) lines.push(`링크: ${s.data.link}`);
      if (s.data.hashtagCount != null) lines.push(`해시태그: ${s.data.hashtagCount}`);
      return lines.join("\n");
    }
    case "cta_restrictions":
      return s.data.blacklist.join("\n");
    default:
      return s.data.text;
  }
}

export function textToSection(
  type: SopItemType,
  text: string,
  source: SopSection["source"] = "user",
): SopSection {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  switch (type) {
    case "prohibited_words":
      return { type, source, data: { words: lines } };
    case "length_limits": {
      const data: LengthLimitsData = {};
      for (const line of lines) {
        const m = line.match(/^([^:：]+)[：:]\s*(\d+)/);
        if (!m) continue;
        const key = LENGTH_LIMIT_KEYS[m[1].trim()];
        if (key) (data as Record<string, number>)[key] = parseInt(m[2], 10);
      }
      return { type, source, data };
    }
    case "cta_restrictions":
      return { type, source, data: { blacklist: lines } };
    default:
      return { type: type as FreeTextSopType, source, data: { text } };
  }
}
