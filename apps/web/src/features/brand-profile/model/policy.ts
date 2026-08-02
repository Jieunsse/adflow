export type SopItemType =
  | "prohibited_words"
  | "required_phrases"
  | "required_hashtags"
  | "length_limits"
  | "cta_restrictions"
  | "image_restrictions"
  | "industry_regulations"
  | "competitor_policy"
  | "pricing_rules"
  | "audience_restrictions"
  | "platform_rules";

export type SopSectionSource = "user" | "ai-classified" | "ai-generated";

export interface ProhibitedWordsData { words: string[]; }
export interface LengthLimitsData { headline?: number; body?: number; link?: number; hashtagCount?: number; }
export interface CtaRestrictionsData { blacklist: string[]; note?: string; }
export interface RequiredPhrasesData { phrases: string[]; }
export interface RequiredHashtagsData { hashtags: string[]; }
export interface FreeTextData { text: string; }

export type FreeTextSopType =
  | "industry_regulations"
  | "competitor_policy"
  | "pricing_rules"
  | "audience_restrictions"
  | "platform_rules"
  | "image_restrictions";

export type SopSection =
  | { type: "prohibited_words"; data: ProhibitedWordsData; source?: SopSectionSource }
  | { type: "required_phrases"; data: RequiredPhrasesData; source?: SopSectionSource }
  | { type: "required_hashtags"; data: RequiredHashtagsData; source?: SopSectionSource }
  | { type: "length_limits"; data: LengthLimitsData; source?: SopSectionSource }
  | { type: "cta_restrictions"; data: CtaRestrictionsData; source?: SopSectionSource }
  | { type: FreeTextSopType; data: FreeTextData; source?: SopSectionSource };

export function isSectionFilled(section: SopSection): boolean {
  switch (section.type) {
    case "prohibited_words": return section.data.words.length > 0;
    case "required_phrases": return section.data.phrases.length > 0;
    case "required_hashtags": return section.data.hashtags.length > 0;
    case "length_limits": return Object.values(section.data).some((value) => value != null);
    case "cta_restrictions": return section.data.blacklist.length > 0 || !!section.data.note?.trim();
    default: return section.data.text.trim().length > 0;
  }
}

export function replacePolicySection(policy: SopSection[], section: SopSection): SopSection[] {
  const others = policy.filter((current) => current.type !== section.type);
  return isSectionFilled(section) ? [...others, section] : others;
}

export function sectionPreviewText(section: SopSection): string {
  switch (section.type) {
    case "prohibited_words": return section.data.words.slice(0, 4).join(", ");
    case "required_phrases": return section.data.phrases.slice(0, 3).join(", ");
    case "required_hashtags": return section.data.hashtags.slice(0, 4).join(" ");
    case "length_limits": {
      const { headline, body, link, hashtagCount } = section.data;
      return [
        headline != null && `헤드라인 ≤ ${headline}자`,
        body != null && `본문 ≤ ${body}자`,
        link != null && `링크 ≤ ${link}자`,
        hashtagCount != null && `해시태그 ≤ ${hashtagCount}개`,
      ].filter(Boolean).slice(0, 3).join(" · ");
    }
    case "cta_restrictions": return section.data.blacklist.slice(0, 4).join(", ");
    default: return section.data.text.split("\n").find((line) => line.trim()) ?? "";
  }
}
