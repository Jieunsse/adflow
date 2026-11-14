package ai.adflow.api.learning;

import ai.adflow.api.store.OwnerScoped;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * 배운 것 기록 (기능 4, 정책서 14절). 판정이 끝나거나 판정 불가가 된 라운드마다 하나씩 서버가 만든다.
 * id 는 "{실험 id}_r{라운드 번호}" 다.
 *
 * <p>숫자·결과·바꾼 요소는 만들 때 정하고 고치지 않는다. 사람은 문장만 고치고 확정·보관한다. 지우지 않는다.
 */
@Entity
@Table(name = "learnings")
public class Learning extends OwnerScoped {

  @Column(name = "brand_profile_id", nullable = false)
  private String brandProfileId;

  @Column(name = "tournament_id", nullable = false)
  private String tournamentId;

  @Column(name = "product_name")
  private String productName;

  @Column(name = "round_index", nullable = false)
  private Integer roundIndex;

  /** 바꾼 요소. headline · primary_text. */
  private String axis;

  @Column(length = 1000)
  private String hypothesis;

  /** challenger_won · champion_won · no_difference · unjudgeable */
  @Column(nullable = false)
  private String result;

  @Column(name = "ctr_a")
  private Double ctrA;

  @Column(name = "ctr_b")
  private Double ctrB;

  private Double confidence;

  @Column(name = "impression_shortfall")
  private Integer impressionShortfall;

  private Double spend;

  @Column(length = 400)
  private String sentence;

  /** draft · confirmed · archived */
  @Column(nullable = false)
  private String status;

  @Column(name = "archive_reason", length = 400)
  private String archiveReason;

  @Column(name = "decided_by")
  private String decidedBy;

  @Column(name = "decided_at")
  private String decidedAt;

  @Column(name = "sentence_edited_by")
  private String sentenceEditedBy;

  @Column(name = "sentence_edited_at")
  private String sentenceEditedAt;

  @Column(name = "created_at", nullable = false)
  private String createdAt;

  public String getBrandProfileId() { return brandProfileId; }
  public void setBrandProfileId(String v) { this.brandProfileId = v; }
  public String getTournamentId() { return tournamentId; }
  public void setTournamentId(String v) { this.tournamentId = v; }
  public String getProductName() { return productName; }
  public void setProductName(String v) { this.productName = v; }
  public Integer getRoundIndex() { return roundIndex; }
  public void setRoundIndex(Integer v) { this.roundIndex = v; }
  public String getAxis() { return axis; }
  public void setAxis(String v) { this.axis = v; }
  public String getHypothesis() { return hypothesis; }
  public void setHypothesis(String v) { this.hypothesis = v; }
  public String getResult() { return result; }
  public void setResult(String v) { this.result = v; }
  public Double getCtrA() { return ctrA; }
  public void setCtrA(Double v) { this.ctrA = v; }
  public Double getCtrB() { return ctrB; }
  public void setCtrB(Double v) { this.ctrB = v; }
  public Double getConfidence() { return confidence; }
  public void setConfidence(Double v) { this.confidence = v; }
  public Integer getImpressionShortfall() { return impressionShortfall; }
  public void setImpressionShortfall(Integer v) { this.impressionShortfall = v; }
  public Double getSpend() { return spend; }
  public void setSpend(Double v) { this.spend = v; }
  public String getSentence() { return sentence; }
  public void setSentence(String v) { this.sentence = v; }
  public String getStatus() { return status; }
  public void setStatus(String v) { this.status = v; }
  public String getArchiveReason() { return archiveReason; }
  public void setArchiveReason(String v) { this.archiveReason = v; }
  public String getDecidedBy() { return decidedBy; }
  public void setDecidedBy(String v) { this.decidedBy = v; }
  public String getDecidedAt() { return decidedAt; }
  public void setDecidedAt(String v) { this.decidedAt = v; }
  public String getSentenceEditedBy() { return sentenceEditedBy; }
  public void setSentenceEditedBy(String v) { this.sentenceEditedBy = v; }
  public String getSentenceEditedAt() { return sentenceEditedAt; }
  public void setSentenceEditedAt(String v) { this.sentenceEditedAt = v; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }
}
