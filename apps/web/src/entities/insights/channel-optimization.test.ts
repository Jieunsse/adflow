import { describe, expect, it } from "vitest";
import { suggestChannelOptimizations } from "./channel-optimization";

describe("suggestChannelOptimizations", () => {
  it("Instagram 저도달에는 오가닉 도달 개선을 제안한다", () => {
    const suggestions = suggestChannelOptimizations("instagram", {
      followers: 1_000, engagementRate: 2, reach: 200, posts: [],
    });

    expect(suggestions.map((suggestion) => suggestion.title)).toContain("오가닉 도달이 팔로워 대비 낮아요");
  });

  it("Facebook 저빈도에는 게시 빈도 개선을 제안한다", () => {
    const suggestions = suggestChannelOptimizations("facebook", {
      followers: 2_000, engagementRate: 2, postCount28d: 3, posts: [],
    });

    expect(suggestions.map((suggestion) => suggestion.title)).toContain("게시 빈도가 낮아요");
  });
});
