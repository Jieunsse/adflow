package ai.adflow.api.meta;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/**
 * 라운드 = 챔피언(A) vs 챌린저(B) 를 ad_studies SPLIT_TEST 로 게재한다. TS:
 * metaAdsCampaign.createSplitTestStudy.
 *
 * <p>셀 = 독립 AdSet 1개 + creative + ad. 두 AdSet 은 동일 타겟이고 axis 한 필드만 갈린다. Meta 가
 * 청중을 50/50 분할하고 유의성 winner 를 스스로 판정한다(ADR §4 정석).
 *
 * <p><b>실 계정 없이 검증할 수 없는 코드다.</b> 방어선은 골든 픽스처
 * ({@code packages/contracts/fixtures/meta/split-test-launch.json}) 하나뿐이다 — TS 클라이언트가
 * 실제로 보내는 요청을 떠낸 파일이고, 여기서 만드는 바디가 그것과 같아야 한다.
 */
@Component
public class MetaSplitTestLauncher {

  public record LaunchResult(String campaignId, List<String> adSetIds, List<String> adIds, String studyId) {}

  /** 한 셀의 크리에이티브 — 축 하나만 A 와 다르다. */
  private record Cell(String imageHash, String headline, String primaryText) {}

  private final MetaGraphClient graph;

  public MetaSplitTestLauncher(MetaGraphClient graph) {
    this.graph = graph;
  }

  public LaunchResult launch(SplitTestRequest p, String token, String accountId, String pageId) {
    if (pageId == null || pageId.isBlank()) {
      throw new IllegalArgumentException("광고를 게재하려면 페이스북 페이지를 먼저 선택해야 해요.");
    }
    if (p.countries() == null || p.countries().isEmpty()) {
      throw new IllegalArgumentException("타겟 지역(국가)을 최소 한 곳 선택해야 해요.");
    }

    MetaGoal goal = MetaGoal.of(p.goalId());
    String imageHash = p.imageDataUrl() == null ? null : uploadImage(p.imageDataUrl(), token, accountId);

    boolean textAxis = SplitTestRequest.AXIS_PRIMARY_TEXT.equals(p.axis());
    Cell a = new Cell(imageHash, p.headline(), p.primaryText());
    Cell b =
        textAxis
            ? new Cell(imageHash, p.headline(), p.challengerPrimaryText())
            : new Cell(imageHash, p.challengerHeadline(), p.primaryText());

    String campaignId = graph.post("/" + accountId + "/campaigns", campaignBody(p, goal), token).path("id").asString();
    try {
      // 셀당 절반 — 총 일 예산이 토너먼트 dailyBudget 과 일치해야 엔진 봉투 회계가 맞는다.
      String cellBudget = String.valueOf(Math.round(p.dailyBudget() / 2));
      List<String> adSetIds = new ArrayList<>();
      List<String> adIds = new ArrayList<>();
      for (String tag : List.of("A", "B")) {
        Cell cell = tag.equals("A") ? a : b;

        Map<String, Object> adSetBody = adSetBody(p, goal, campaignId, pageId);
        adSetBody.put("name", "AdFlow AdSet " + tag + " — " + cell.headline());
        adSetBody.put("daily_budget", cellBudget);
        String adSetId = graph.post("/" + accountId + "/adsets", adSetBody, token).path("id").asString();

        String creativeId =
            graph.post("/" + accountId + "/adcreatives", creativeBody(p, pageId, cell, tag), token)
                .path("id")
                .asString();
        String adId =
            graph.post("/" + accountId + "/ads", adBody(adSetId, creativeId, cell.headline(), tag), token)
                .path("id")
                .asString();

        adSetIds.add(adSetId);
        adIds.add(adId);
      }

      String studyId =
          graph.post("/" + accountId + "/ad_studies", studyBody(p, adSetIds), token).path("id").asString();

      return new LaunchResult(campaignId, adSetIds, adIds, studyId);
    } catch (RuntimeException err) {
      // 여기서 실패하면 광고 계정에 빈 캠페인이 남는다 — 정리하고 원래 오류를 다시 던진다.
      try {
        graph.delete("/" + campaignId + "?access_token=" + token);
      } catch (RuntimeException ignored) {
        // 정리 실패는 의도적으로 삼킨다.
      }
      throw mapSplitTestError(err);
    }
  }

  /**
   * ADR-053 — split test 게재 거절을 한국어로 정직하게 번역. TS: mapSplitTestError.
   *
   * <p>우선순위 ① 알려진 split-test subcode → 우리 한국어 ② Meta 가 준 사람 말 ③ 제네릭 폴백.
   * 인증 만료는 재로그인 경로를 살리려고 그대로 통과시킨다.
   */
  static RuntimeException mapSplitTestError(RuntimeException err) {
    if (err instanceof MetaApiException meta) {
      if (meta.isAuthExpired()) return meta;
      // 셀당 최소 예산 미달 (Meta subcode 1487390)
      if (Integer.valueOf(1487390).equals(meta.getSubcode())) {
        return new IllegalStateException(
            "A/B 게재 예산이 부족해요. 안(셀)마다 따로 예산이 들어가니, 일 예산을 더 올려주세요.");
      }
      if (meta.getUserMessage() != null) return new IllegalStateException(meta.getUserMessage());
    }
    return new IllegalStateException("Meta 가 A/B 게재를 거절했어요. 보통 예산·기간·목표 조건 때문이에요.");
  }

  private String uploadImage(String dataUrl, String token, String accountId) {
    String base64 = dataUrl.contains(",") ? dataUrl.substring(dataUrl.indexOf(',') + 1) : dataUrl;
    JsonNode data = graph.post("/" + accountId + "/adimages", Map.of("bytes", base64), token);
    JsonNode images = data.get("images");
    if (images != null) {
      for (JsonNode img : images) {
        String hash = img.path("hash").asString(null);
        if (hash != null && !hash.isBlank()) return hash;
      }
    }
    throw new IllegalStateException("광고 이미지 업로드에 실패했어요. 다른 이미지로 다시 시도해주세요.");
  }

  private static Map<String, Object> campaignBody(SplitTestRequest p, MetaGoal goal) {
    String mmdd = p.startDate().substring(5, 7) + p.startDate().substring(8, 10);
    String brandPart = p.brandName() == null || p.brandName().isBlank() ? "" : " — " + p.brandName();
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("name", "AdFlow" + brandPart + " — " + goal.label() + " — " + p.headline() + " — " + mmdd);
    body.put("objective", goal.metaObjective());
    body.put("status", "ACTIVE");
    body.put("special_ad_categories", List.of());
    body.put("is_adset_budget_sharing_enabled", false);
    return body;
  }

  private static Map<String, Object> adSetBody(
      SplitTestRequest p, MetaGoal goal, String campaignId, String pageId) {

    Map<String, Object> targeting = new LinkedHashMap<>();
    targeting.put("age_min", p.ageMin());
    targeting.put("age_max", p.ageMax());
    if (p.genders() != null && !p.genders().isEmpty()) targeting.put("genders", p.genders());
    targeting.put("geo_locations", Map.of("countries", p.countries()));
    // 폴러 경로는 항상 detailed 취급이다 — Advantage+ 오디언스는 게재 마법사의 simple 모드 전용.
    targeting.put("targeting_automation", Map.of("advantage_audience", 0));

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("campaign_id", campaignId);
    body.put("billing_event", "IMPRESSIONS");
    body.put("optimization_goal", goal.optimizationGoal());
    body.put("bid_strategy", "LOWEST_COST_WITHOUT_CAP");
    if (goal.destinationType() != null) body.put("destination_type", goal.destinationType());
    if (goal.promotesPage()) body.put("promoted_object", Map.of("page_id", pageId));
    body.put("targeting", targeting);
    body.put("start_time", toUnixKst(p.startDate(), false));
    body.put("end_time", toUnixKst(p.endDate(), true));
    body.put("status", "ACTIVE");
    return body;
  }

  private static Map<String, Object> creativeBody(SplitTestRequest p, String pageId, Cell cell, String tag) {
    Map<String, Object> linkData = new LinkedHashMap<>();
    linkData.put("message", cell.primaryText());
    linkData.put("link", p.linkUrl());
    linkData.put("name", cell.headline());
    linkData.put("call_to_action", ctaForCreative(p.ctaType()));
    if (cell.imageHash() != null) linkData.put("image_hash", cell.imageHash());

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("name", "AdFlow Creative " + tag + " — " + cell.headline());
    body.put("object_story_spec", Map.of("page_id", pageId, "link_data", linkData));
    return body;
  }

  /** Messenger 광고는 app_destination 이 필요하다. CALL_NOW 의 tel: 링크는 폴러 경로에 없다. */
  private static Map<String, Object> ctaForCreative(String ctaType) {
    if ("MESSAGE_PAGE".equals(ctaType)) {
      return Map.of("type", ctaType, "value", Map.of("app_destination", "MESSENGER"));
    }
    return Map.of("type", ctaType);
  }

  private static Map<String, Object> adBody(String adSetId, String creativeId, String headline, String tag) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("name", "AdFlow Ad " + tag + " — " + headline);
    body.put("adset_id", adSetId);
    body.put("creative", Map.of("creative_id", creativeId));
    body.put("status", "ACTIVE");
    return body;
  }

  private static Map<String, Object> studyBody(SplitTestRequest p, List<String> adSetIds) {
    String name = "AdFlow Split — " + p.headline();
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("name", name.length() > 80 ? name.substring(0, 80) : name);
    body.put("description", "AdFlow A/B 토너먼트 라운드");
    body.put("type", "SPLIT_TEST");
    body.put("start_time", toUnixKst(p.startDate(), false));
    body.put("end_time", toUnixKst(p.endDate(), true));
    body.put(
        "cells",
        List.of(
            Map.of("name", "A", "treatment_percentage", 50, "adsets", List.of(adSetIds.get(0))),
            Map.of("name", "B", "treatment_percentage", 50, "adsets", List.of(adSetIds.get(1)))));
    return body;
  }

  /** 날짜는 KST 로 해석한다 — UTC 로 읽으면 하루가 밀린다(TS toUnixKST 와 같은 규칙). */
  private static long toUnixKst(String date, boolean endOfDay) {
    return OffsetDateTime.parse(date + (endOfDay ? "T23:59:59+09:00" : "T00:00:00+09:00")).toEpochSecond();
  }
}
