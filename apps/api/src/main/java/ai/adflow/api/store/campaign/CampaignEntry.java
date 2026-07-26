package ai.adflow.api.store.campaign;

import ai.adflow.api.store.creator.Performance;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Embedded;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import io.swagger.v3.oas.annotations.media.Schema;

/** TS: apps/web/src/entities/influencer-campaign/model.ts 의 CampaignEntry. */
@Embeddable
public class CampaignEntry {

  @Column(name = "creator_id")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String creatorId;

  @Enumerated(EnumType.STRING)
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private CampaignStage stage;

  @Column(name = "outreach_draft", length = 4000)
  private String outreachDraft;

  @Column(name = "content_guideline", length = 4000)
  private String contentGuideline;

  @Column(name = "content_url", length = 2000)
  private String contentUrl;

  /**
   * 컬렉션 테이블의 조인 컬럼이 campaign_id 인데 Performance 도 campaign_id 를 매핑해 충돌한다
   * (MappingException: Column 'campaign_id' is duplicated in mapping for collection).
   * 조인 컬럼 이름은 자연스러운 쪽을 지키고 임베더블 쪽을 옮긴다. 와이어는 그대로 campaignId 다.
   */
  @Embedded
  @AttributeOverride(name = "campaignId", column = @Column(name = "perf_campaign_id"))
  private Performance performance;

  @Column(name = "paid_at")
  private String paidAt;

  @Column(name = "updated_at")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String updatedAt;

  public String getCreatorId() { return creatorId; }
  public void setCreatorId(String v) { this.creatorId = v; }
  public CampaignStage getStage() { return stage; }
  public void setStage(CampaignStage v) { this.stage = v; }
  public String getOutreachDraft() { return outreachDraft; }
  public void setOutreachDraft(String v) { this.outreachDraft = v; }
  public String getContentGuideline() { return contentGuideline; }
  public void setContentGuideline(String v) { this.contentGuideline = v; }
  public String getContentUrl() { return contentUrl; }
  public void setContentUrl(String v) { this.contentUrl = v; }
  public Performance getPerformance() { return performance; }
  public void setPerformance(Performance v) { this.performance = v; }
  public String getPaidAt() { return paidAt; }
  public void setPaidAt(String v) { this.paidAt = v; }
  public String getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(String v) { this.updatedAt = v; }
}
