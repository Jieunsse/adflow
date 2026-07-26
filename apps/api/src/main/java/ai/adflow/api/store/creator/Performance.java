package ai.adflow.api.store.creator;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * TS: CreatorPerformance. Creator.performanceHistory 와 CampaignEntry.performance 가 공유한다.
 *
 * @Embeddable 인 이유 — 한 타입이 @Entity 이면서 @Embeddable 일 수 없는데 양쪽에서 필요하다.
 * 임베더블로 두면 컬렉션 테이블(@ElementCollection)과 인라인(@Embedded) 양쪽으로 쓸 수 있다.
 */
@Embeddable
public class Performance {

  @Column(name = "campaign_id")
  private String campaignId;

  private Integer reach;
  private Integer clicks;
  private Integer conversions;
  private Double revenue;
  private Double cost;

  @Column(name = "recorded_at")
  private String recordedAt;

  public String getCampaignId() { return campaignId; }
  public void setCampaignId(String v) { this.campaignId = v; }
  public Integer getReach() { return reach; }
  public void setReach(Integer v) { this.reach = v; }
  public Integer getClicks() { return clicks; }
  public void setClicks(Integer v) { this.clicks = v; }
  public Integer getConversions() { return conversions; }
  public void setConversions(Integer v) { this.conversions = v; }
  public Double getRevenue() { return revenue; }
  public void setRevenue(Double v) { this.revenue = v; }
  public Double getCost() { return cost; }
  public void setCost(Double v) { this.cost = v; }
  public String getRecordedAt() { return recordedAt; }
  public void setRecordedAt(String v) { this.recordedAt = v; }
}
