package ai.adflow.api.portal;

import ai.adflow.api.store.OwnerScoped;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * 직원이 "고객에게 공유"한 성과 리포트 (기능 6, 정책서 16.1). 공유한 순간의 숫자를 그대로 남긴다 — 고객은 이 기록만
 * 보고, 공유 전 리포트는 보지 못한다. 숫자는 웹이 정책서 8.2 계산으로 만든 값이다.
 */
@Entity
@Table(name = "shared_reports")
public class SharedReport extends OwnerScoped {

  @Column(name = "brand_profile_id", nullable = false)
  private String brandProfileId;

  /** weekly · monthly */
  @Column(nullable = false)
  private String kind;

  @Column(name = "range_start", nullable = false)
  private String rangeStart;

  @Column(name = "range_end", nullable = false)
  private String rangeEnd;

  /** [{key,label,value,previous,unit}] */
  @Column(name = "metrics_json", columnDefinition = "text")
  private String metricsJson;

  /** [{sentence,tournamentId,roundIndex}] — 이 기간에 확정한 배운 것 */
  @Column(name = "reasons_json", columnDefinition = "text")
  private String reasonsJson;

  @Column(name = "next_steps", length = 2000)
  private String nextSteps;

  @Column(name = "shared_by")
  private String sharedBy;

  @Column(name = "shared_at")
  private String sharedAt;

  public String getBrandProfileId() { return brandProfileId; }
  public void setBrandProfileId(String v) { this.brandProfileId = v; }
  public String getKind() { return kind; }
  public void setKind(String v) { this.kind = v; }
  public String getRangeStart() { return rangeStart; }
  public void setRangeStart(String v) { this.rangeStart = v; }
  public String getRangeEnd() { return rangeEnd; }
  public void setRangeEnd(String v) { this.rangeEnd = v; }
  public String getMetricsJson() { return metricsJson; }
  public void setMetricsJson(String v) { this.metricsJson = v; }
  public String getReasonsJson() { return reasonsJson; }
  public void setReasonsJson(String v) { this.reasonsJson = v; }
  public String getNextSteps() { return nextSteps; }
  public void setNextSteps(String v) { this.nextSteps = v; }
  public String getSharedBy() { return sharedBy; }
  public void setSharedBy(String v) { this.sharedBy = v; }
  public String getSharedAt() { return sharedAt; }
  public void setSharedAt(String v) { this.sharedAt = v; }
}
