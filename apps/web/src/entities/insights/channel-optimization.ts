import type { Suggestion } from "./suggestion";

export type ChannelKind = "instagram" | "facebook";

export type ChannelOptInput = {
  followers: number;
  engagementRate: number;
  reach?: number;
  postCount28d?: number;
  posts: Array<{ id?: string; engagement: number }>;
};

const LOW_ENGAGEMENT = 1.0;
const GOOD_ENGAGEMENT = 3.0;
const LOW_REACH_RATE = 30;
const LOW_FB_POST_FREQ = 4;
const LOW_FOLLOWER_COUNT = 1000;

function fmtK(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function suggestChannelOptimizations(channel: ChannelKind, input: ChannelOptInput): Suggestion[] {
  const { followers, engagementRate, posts } = input;
  const out: Suggestion[] = [];

  if (engagementRate < LOW_ENGAGEMENT) {
    out.push({
      kind: "note", severity: "warn", title: "인게이지먼트율이 낮아요",
      detail: channel === "instagram"
        ? [`현재 ${engagementRate.toFixed(1)}%로 비즈니스 계정 평균(1~3%) 아래예요.`, `정보성(팁·인포그래픽), 참여 유도(질문·투표), 뒷이야기 콘텐츠가 반응을 높이는 데 효과적이에요.`, `스토리 설문·퀴즈를 활용하면 알고리즘 노출도 함께 높아져요.`]
        : [`현재 ${engagementRate.toFixed(1)}%로 페이지 평균(1~3%) 아래예요.`, `짧은 영상(60초 이하)·라이브가 페이지 알고리즘 노출을 높이는 데 효과적이에요.`, `질문 던지기·투표 게시물로 댓글을 유도하면 자연 도달이 함께 올라가요.`],
      action: { kind: "ai-draft" },
    });
  } else if (engagementRate >= GOOD_ENGAGEMENT) {
    out.push({
      kind: "note", severity: "info", title: "인게이지먼트율이 좋아요",
      detail: channel === "instagram"
        ? [`${engagementRate.toFixed(1)}%로 평균(1~3%)보다 높아요.`, `성과 좋은 게시물의 포맷·주제·시간대를 파악해 비슷한 콘텐츠를 더 올려보세요.`, `협업 게시물(Collab post)이나 릴스 확장을 고려해볼 좋은 시점이에요.`]
        : [`${engagementRate.toFixed(1)}%로 평균(1~3%)보다 높아요.`, `성과 좋은 게시물의 포맷·주제·시간대를 파악해 비슷한 콘텐츠를 더 올려보세요.`, `라이브·짧은 영상을 시리즈로 늘리면 도달이 안정적으로 커져요.`],
      action: { kind: "ai-draft" },
    });
  } else {
    out.push({
      kind: "note", severity: "info", title: "인게이지먼트율이 안정적이에요",
      detail: channel === "instagram"
        ? [`${engagementRate.toFixed(1)}%로 평균 범위 안에 있어요.`, `저장 수가 높은 게시물이 오가닉 도달에 가장 효과적이에요 — '저장하고 싶은' 정보성 콘텐츠를 늘려보세요.`]
        : [`${engagementRate.toFixed(1)}%로 평균 범위 안에 있어요.`, `공유 수가 높은 게시물이 자연 도달을 키워요 — '공유하고 싶은' 정보성·감정적 콘텐츠를 늘려보세요.`],
      action: { kind: "ai-draft" },
    });
  }

  if (channel === "instagram") {
    const reach = input.reach ?? 0;
    if (followers > 0 && reach > 0 && (reach / followers) * 100 < LOW_REACH_RATE) {
      out.push({
        kind: "note", severity: "warn", title: "오가닉 도달이 팔로워 대비 낮아요",
        detail: [`28일 도달(${fmtK(reach)})이 팔로워(${fmtK(followers)}) 대비 ${((reach / followers) * 100).toFixed(0)}%예요.`, `팔로워 활동이 많은 시간대(보통 저녁 7~9시)에 맞춰 게시하고, 인기 해시태그 3~5개를 활용해보세요.`, `릴스는 피드보다 알고리즘 노출이 높아요 — 기존 콘텐츠를 릴스로 리패키징해보세요.`],
        action: { kind: "ai-draft" },
      });
    }
  } else if ((input.postCount28d ?? 0) < LOW_FB_POST_FREQ) {
    out.push({
      kind: "note", severity: "warn", title: "게시 빈도가 낮아요",
      detail: [`최근 28일 게시물이 ${input.postCount28d ?? 0}개로 주 1회 미만이에요.`, `페이지 알고리즘은 꾸준한 게시 활동을 선호해요 — 주 2~3회 페이스를 권해요.`, `짧은 영상·라이브·이미지 카드 등 포맷을 섞으면 같은 주제도 다르게 보여줄 수 있어요.`],
      action: { kind: "ai-draft" },
    });
  }

  if (posts.length > 0) {
    const best = [...posts].sort((a, b) => b.engagement - a.engagement)[0];
    if (best.engagement > 0) {
      out.push({
        kind: "note", severity: "info", title: "최고 성과 게시물에서 힌트를 얻어보세요",
        detail: [`가장 반응이 좋은 게시물의 총 반응 ${fmtK(best.engagement)}회.`, `이 게시물의 포맷·주제·표현 방식을 분석해 비슷한 콘텐츠를 기획해보세요.`],
        action: channel === "instagram" && best.id ? { kind: "boost-post", igMediaId: best.id } : undefined,
      });
    }
  }

  if (followers < LOW_FOLLOWER_COUNT) {
    out.push({
      kind: "note", severity: "info", title: "팔로워 성장이 중요한 단계예요",
      detail: channel === "instagram"
        ? [`팔로워 ${fmtK(followers)}명으로 초기 성장 단계예요.`, `광고 집행과 오가닉 콘텐츠를 병행하면 팔로워 확보 속도를 높일 수 있어요.`, `프로필 바이오와 하이라이트를 정리해 첫 방문자의 팔로우 전환율을 높여보세요.`]
        : [`팔로워 ${fmtK(followers)}명으로 초기 성장 단계예요.`, `광고 집행과 오가닉 콘텐츠를 병행하면 팔로워 확보 속도를 높일 수 있어요.`, `페이지 CTA 버튼(메시지·문의·예약)이 명확히 설정돼 있는지 점검해보세요.`],
      action: { kind: "create-campaign" },
    });
  }

  return out;
}
