package ai.adflow.api.store.launch;

import ai.adflow.api.store.JsonNodeConverter;
import ai.adflow.api.store.OwnerScoped;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.List;
import tools.jackson.databind.JsonNode;

/**
 * TS: apps/web/src/entities/campaign/model.tsx 의 LaunchedCampaign. 게재 영수증이다.
 *
 * 서버는 이 값을 해석하지 않는다. 셋은 OpenAPI 로 표현할 수 없어 계약이 지켜주지 못한다 —
 * adIds(TS 튜플)·abTestVariantB(판별 유니온)·goalId(const 배열 파생 유니온).
 * contract-compat.ts 에 예외로 적어뒀다.
 */
@Entity
@Table(name = "campaign_launches")
@JsonIgnoreProperties("id")
public class CampaignLaunch extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "ad_set_id")
  private String adSetId;

  @Column(name = "ad_id")
  private String adId;

  /** TS 는 [string, string] 튜플이다. springdoc 이 prefixItems 를 내지 않아 string[] 로 나간다. */
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "campaign_launch_ad_ids", joinColumns = @JoinColumn(name = "campaign_id"))
  @Column(name = "ad_id_value")
  @OrderColumn(name = "position")
  private List<String> adIds;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "daily_budget")
  private Double dailyBudget;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "start_date")
  private String startDate;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "end_date")
  private String endDate;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Enumerated(EnumType.STRING)
  private LaunchStatus status;

  /** Meta objective. 값이 늘어나는 축이라 자바 enum 대신 String + 스키마 허용값으로 둔다. */
  @Schema(
      allowableValues = {
        "OUTCOME_TRAFFIC",
        "OUTCOME_AWARENESS",
        "OUTCOME_ENGAGEMENT",
        "OUTCOME_LEADS",
        "OUTCOME_SALES",
        "OUTCOME_APP_PROMOTION"
      })
  private String objective;

  /** ObjectivePhase1Id — const 배열에서 파생된 유니온이라 Java 로 옮기면 목록이 두 곳에 산다. */
  @Column(name = "goal_id")
  private String goalId;

  private Boolean skipped;

  @Enumerated(EnumType.STRING)
  @Column(name = "ab_test_axis")
  private AbTestAxis abTestAxis;

  @Column(name = "ab_test_variant_a", length = 2000)
  private String abTestVariantA;

  /** 판별 유니온 — Sop.sections·BrandProfile.policy 와 같은 처방. */
  @Convert(converter = JsonNodeConverter.class)
  @Column(name = "ab_test_variant_b", columnDefinition = "text")
  private JsonNode abTestVariantB;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @JsonProperty("campaignId")
  public String getCampaignId() { return getId(); }

  @JsonProperty("campaignId")
  public void setCampaignId(String v) { setId(v); }

  public String getAdSetId() { return adSetId; }
  public void setAdSetId(String v) { this.adSetId = v; }
  public String getAdId() { return adId; }
  public void setAdId(String v) { this.adId = v; }
  // Hibernate 는 로드 시 @ElementCollection 의 null 을 빈 컬렉션으로 바꾼다. 그대로 두면
  // 전역 non_null 정책을 통과해 [] 가 나가고, TS 의 optional(키 부재)과 어긋난다.
  // 이 필드들은 "미지정"과 "빈 목록"이 같은 뜻이라 비었으면 null 로 접는다.
  public List<String> getAdIds() { return adIds == null || adIds.isEmpty() ? null : adIds; }
  public void setAdIds(List<String> v) { this.adIds = v; }
  public Double getDailyBudget() { return dailyBudget; }
  public void setDailyBudget(Double v) { this.dailyBudget = v; }
  public String getStartDate() { return startDate; }
  public void setStartDate(String v) { this.startDate = v; }
  public String getEndDate() { return endDate; }
  public void setEndDate(String v) { this.endDate = v; }
  public LaunchStatus getStatus() { return status; }
  public void setStatus(LaunchStatus v) { this.status = v; }
  public String getObjective() { return objective; }
  public void setObjective(String v) { this.objective = v; }
  public String getGoalId() { return goalId; }
  public void setGoalId(String v) { this.goalId = v; }
  public Boolean getSkipped() { return skipped; }
  public void setSkipped(Boolean v) { this.skipped = v; }
  public AbTestAxis getAbTestAxis() { return abTestAxis; }
  public void setAbTestAxis(AbTestAxis v) { this.abTestAxis = v; }
  public String getAbTestVariantA() { return abTestVariantA; }
  public void setAbTestVariantA(String v) { this.abTestVariantA = v; }
  public JsonNode getAbTestVariantB() { return abTestVariantB; }
  public void setAbTestVariantB(JsonNode v) { this.abTestVariantB = v; }
}
