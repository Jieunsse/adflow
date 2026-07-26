package ai.adflow.api.meta;

import java.util.List;

/**
 * Phase 1 광고 목표 표. TS: OBJECTIVES_PHASE1 (entities/creative/options.ts).
 *
 * <p>여기 옮긴 것은 <b>게재에 쓰이는 5필드뿐</b>이다 — 아이콘·설명·카피톤 같은 화면용 필드는 TS 에
 * 남는다. 목록이 두 곳에 살게 되지만 골든 픽스처가 값을 지킨다(단계 5 의 leverPool 과 같은 처방).
 *
 * <p>{@code label} 은 캠페인 이름에 들어가 Meta Ads Manager 에 그대로 보인다 — 표시용이 아니라
 * 요청 바디의 일부라서 옮겨야 한다.
 */
public record MetaGoal(
    String id,
    String label,
    String metaObjective,
    String optimizationGoal,
    String destinationType,
    boolean promotesPage) {

  private static final List<MetaGoal> ALL =
      List.of(
          new MetaGoal("awareness", "인지도", "OUTCOME_AWARENESS", "REACH", null, false),
          new MetaGoal("traffic", "웹사이트 방문", "OUTCOME_TRAFFIC", "LINK_CLICKS", "WEBSITE", false),
          new MetaGoal("traffic_page_visit", "페이지 방문", "OUTCOME_TRAFFIC", "LANDING_PAGE_VIEWS", "WEBSITE", false),
          new MetaGoal("engagement", "게시물 참여", "OUTCOME_ENGAGEMENT", "POST_ENGAGEMENT", null, false),
          new MetaGoal("engagement_page_likes", "페이지 팔로우", "OUTCOME_ENGAGEMENT", "PAGE_LIKES", "ON_PAGE", true),
          new MetaGoal("engagement_messages", "메시지 받기", "OUTCOME_ENGAGEMENT", "CONVERSATIONS", "MESSENGER", true),
          new MetaGoal("leads_call", "전화 받기", "OUTCOME_LEADS", "QUALITY_CALL", "PHONE_CALL", true),
          new MetaGoal("boost_post", "콘텐츠 홍보", "OUTCOME_ENGAGEMENT", "POST_ENGAGEMENT", null, true));

  /**
   * goalId 미지정은 레거시 경로다 — TS 는 objective 기본값(OUTCOME_TRAFFIC)에서 LINK_CLICKS·WEBSITE 를
   * 도출하고 라벨은 "TRAFFIC"(접두사 제거)을 쓴다. 그 조합을 값 하나로 굳혀둔다.
   */
  public static final MetaGoal LEGACY_TRAFFIC =
      new MetaGoal(null, "TRAFFIC", "OUTCOME_TRAFFIC", "LINK_CLICKS", "WEBSITE", false);

  public static MetaGoal of(String goalId) {
    if (goalId == null || goalId.isBlank()) return LEGACY_TRAFFIC;
    return ALL.stream().filter(g -> g.id.equals(goalId)).findFirst().orElse(LEGACY_TRAFFIC);
  }
}
