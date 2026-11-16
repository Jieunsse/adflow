package ai.adflow.api.meta;

import java.util.List;

/**
 * 한 라운드 게재에 필요한 것 전부. TS: CreateCampaignParams 중 토너먼트가 실제로 채우는 필드만.
 *
 * <p>TS 의 CreateCampaignParams 는 25필드지만 토너먼트 delivery 봉투가 표현할 수 있는 것은 여기까지다
 * — pixelId·customAudienceId·bidAmount·placements·phoneNumber·mode 는 게재 마법사 경로에서만 오고
 * 폴러는 절대 채우지 않는다. 안 쓰는 필드를 옮기면 Java 쪽에 검증할 수 없는 분기가 생긴다.
 *
 * @param axis 갈리는 축. "primary_text" 아니면 헤드라인으로 접는다(TS 와 같은 폴백).
 */
public record SplitTestRequest(
    String headline,
    String primaryText,
    String axis,
    String challengerHeadline,
    String challengerPrimaryText,
    double dailyBudget,
    String startDate,
    String endDate,
    Integer ageMin,
    Integer ageMax,
    List<Integer> genders,
    List<String> countries,
    String linkUrl,
    String ctaType,
    String imageDataUrl,
    String goalId,
    String brandName) {

  public static final String AXIS_PRIMARY_TEXT = "primary_text";
}
