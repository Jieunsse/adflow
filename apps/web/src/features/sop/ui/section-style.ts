import type { SopItemType } from "@features/sop/model/useSopStorage";

export const SECTION_ICON: Record<SopItemType, string> = {
  prohibited_words: "warn",
  required_phrases: "check-circle",
  required_hashtags: "hash",
  length_limits: "doc",
  cta_restrictions: "megaphone",
  image_restrictions: "image",
  industry_regulations: "lock",
  competitor_policy: "users",
  pricing_rules: "wallet",
  audience_restrictions: "target",
  platform_rules: "globe",
};

export const SECTION_ACCENT: Record<SopItemType, string> = {
  prohibited_words: "var(--w-status-negative)",
  required_phrases: "var(--w-status-positive)",
  required_hashtags: "var(--w-accent-cyan)",
  length_limits: "var(--w-status-info)",
  cta_restrictions: "var(--w-accent-violet)",
  image_restrictions: "var(--w-status-cautionary)",
  industry_regulations: "var(--w-status-cautionary)",
  competitor_policy: "var(--w-accent-cyan)",
  pricing_rules: "var(--w-status-positive)",
  audience_restrictions: "var(--w-accent-violet)",
  platform_rules: "var(--w-status-info)",
};
