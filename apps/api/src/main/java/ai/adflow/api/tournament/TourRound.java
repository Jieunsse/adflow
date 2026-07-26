package ai.adflow.api.tournament;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.List;

/**
 * 한 라운드 = 챔피언 vs 챌린저 1회 대결. TS: TourRound.
 *
 * <p>id 는 서버가 만든다 — TS 에 없는 필드라 @JsonIgnore 로 감춘다. 라운드의 정체성은 (토너먼트,
 * index) 이고 클라는 index 로만 말한다.
 */
@Entity
@Table(name = "tour_rounds")
public class TourRound {

  /** 판정 결과. TS: RoundVerdict. */
  @Embeddable
  public static class Verdict {
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "verdict_state")
    private String state;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "verdict_ctr_a")
    private Double ctrA;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "verdict_ctr_b")
    private Double ctrB;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "verdict_confidence")
    private Double confidence;

    public String getState() { return state; }
    public void setState(String v) { this.state = v; }
    public Double getCtrA() { return ctrA; }
    public void setCtrA(Double v) { this.ctrA = v; }
    public Double getCtrB() { return ctrB; }
    public void setCtrB(Double v) { this.ctrB = v; }
    public Double getConfidence() { return confidence; }
    public void setConfidence(Double v) { this.confidence = v; }
  }

  /** 광고 1개의 성과 스냅샷. TS: AdKpi. */
  @Embeddable
  public static class Kpi {
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private Double ctr;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private Integer impressions;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private Integer clicks;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private Double spend;

    public Double getCtr() { return ctr; }
    public void setCtr(Double v) { this.ctr = v; }
    public Integer getImpressions() { return impressions; }
    public void setImpressions(Integer v) { this.impressions = v; }
    public Integer getClicks() { return clicks; }
    public void setClicks(Integer v) { this.clicks = v; }
    public Double getSpend() { return spend; }
    public void setSpend(Double v) { this.spend = v; }
  }

  /** Ledger 필터·가중 키. TS: Hypothesis["contextTags"]. */
  @Embeddable
  public static class ContextTags {
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "ctx_product_id")
    private String productId;

    @Column(name = "ctx_persona_id")
    private String personaId;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "ctx_objective")
    private String objective;

    public String getProductId() { return productId; }
    public void setProductId(String v) { this.productId = v; }
    public String getPersonaId() { return personaId; }
    public void setPersonaId(String v) { this.personaId = v; }
    public String getObjective() { return objective; }
    public void setObjective(String v) { this.objective = v; }
  }

  /**
   * 이 라운드가 검증하는 반증 가능한 인과 단언 (ADR-044). TS: Hypothesis.
   *
   * <p>lever 는 CopyHook|NonCopyLever 유니온이라 Java enum 으로 옮기면 목록이 두 곳에 산다 —
   * String 으로 두고 골든 픽스처가 값 목록을 지킨다.
   */
  @Embeddable
  public static class HypothesisData {
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "hyp_id")
    private String id;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "hyp_lever")
    private String lever;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "hyp_statement", length = 1000)
    private String statement;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "hyp_predicted_metric")
    private String predictedMetric;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "hyp_predicted_direction")
    private String predictedDirection;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "hyp_rationale", length = 2000)
    private String rationale;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "hyp_rationale_source")
    private String rationaleSource;

    @Embedded private ContextTags contextTags;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "hyp_status")
    private String status;

    @Column(name = "hyp_verdict")
    private String verdict;

    @Column(name = "hyp_effect_size")
    private Double effectSize;

    @Column(name = "hyp_resolved_at")
    private String resolvedAt;

    public String getId() { return id; }
    public void setId(String v) { this.id = v; }
    public String getLever() { return lever; }
    public void setLever(String v) { this.lever = v; }
    public String getStatement() { return statement; }
    public void setStatement(String v) { this.statement = v; }
    public String getPredictedMetric() { return predictedMetric; }
    public void setPredictedMetric(String v) { this.predictedMetric = v; }
    public String getPredictedDirection() { return predictedDirection; }
    public void setPredictedDirection(String v) { this.predictedDirection = v; }
    public String getRationale() { return rationale; }
    public void setRationale(String v) { this.rationale = v; }
    public String getRationaleSource() { return rationaleSource; }
    public void setRationaleSource(String v) { this.rationaleSource = v; }

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    public ContextTags getContextTags() { return contextTags; }

    public void setContextTags(ContextTags v) { this.contextTags = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }
    public String getVerdict() { return verdict; }
    public void setVerdict(String v) { this.verdict = v; }
    public Double getEffectSize() { return effectSize; }
    public void setEffectSize(Double v) { this.effectSize = v; }
    public String getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(String v) { this.resolvedAt = v; }
  }

  /** Hibernate 가 전 필드 null 인 임베더블을 빈 객체로 되살리면 `{}` 가 와이어에 나간다. */
  static HypothesisData nullIfEmpty(HypothesisData h) {
    return h == null || h.getId() == null ? null : h;
  }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @JsonIgnore
  private Long id;

  /** TS 는 1-based index. `index` 는 SQL 예약어라 컬럼명을 달리한다. */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "round_index")
  private Integer index;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String axis;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "campaign_id")
  private String campaignId;

  @Embedded
  @AttributeOverrides({
    @AttributeOverride(name = "headline", column = @Column(name = "champion_headline", length = 1000)),
    @AttributeOverride(name = "primaryText", column = @Column(name = "champion_primary_text", length = 4000)),
    @AttributeOverride(name = "imageUrl", column = @Column(name = "champion_image_url", length = 2048))
  })
  private Tournament.Variant champion;

  @Embedded
  @AttributeOverrides({
    @AttributeOverride(name = "headline", column = @Column(name = "challenger_headline", length = 1000)),
    @AttributeOverride(name = "primaryText", column = @Column(name = "challenger_primary_text", length = 4000)),
    @AttributeOverride(name = "imageUrl", column = @Column(name = "challenger_image_url", length = 2048))
  })
  private Tournament.Variant challenger;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "fast_forward_days")
  private Integer fastForwardDays;

  @Embedded private Verdict verdict;

  @Column(name = "raw_winner")
  private String rawWinner;

  /** TS 는 [AdKpi, AdKpi] 튜플. springdoc 이 prefixItems 를 못 내 배열로 나간다(단계 3 과 동일). */
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "tour_round_ad_kpis", joinColumns = @JoinColumn(name = "round_id"))
  @OrderColumn(name = "position")
  private List<Kpi> adKpis;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "tour_round_ad_ids", joinColumns = @JoinColumn(name = "round_id"))
  @Column(name = "ad_id")
  @OrderColumn(name = "position")
  private List<String> adIds;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "tour_round_ad_set_ids", joinColumns = @JoinColumn(name = "round_id"))
  @Column(name = "ad_set_id")
  @OrderColumn(name = "position")
  private List<String> adSetIds;

  @Column(name = "study_id")
  private String studyId;

  @Column(name = "launched_at")
  private String launchedAt;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String status;

  @Embedded private HypothesisData hypothesis;

  public Integer getIndex() { return index; }
  public void setIndex(Integer v) { this.index = v; }
  public String getAxis() { return axis; }
  public void setAxis(String v) { this.axis = v; }
  public String getCampaignId() { return campaignId; }
  public void setCampaignId(String v) { this.campaignId = v; }
  public Tournament.Variant getChampion() { return champion; }
  public void setChampion(Tournament.Variant v) { this.champion = v; }
  public Tournament.Variant getChallenger() { return challenger; }
  public void setChallenger(Tournament.Variant v) { this.challenger = v; }
  public Integer getFastForwardDays() { return fastForwardDays; }
  public void setFastForwardDays(Integer v) { this.fastForwardDays = v; }

  /** 미결산 라운드는 verdict 가 없다. 빈 객체가 나가면 화면이 state 를 읽다 깨진다. */
  public Verdict getVerdict() {
    return verdict == null || verdict.getState() == null ? null : verdict;
  }

  public void setVerdict(Verdict v) { this.verdict = v; }
  public String getRawWinner() { return rawWinner; }
  public void setRawWinner(String v) { this.rawWinner = v; }

  public List<Kpi> getAdKpis() { return adKpis == null || adKpis.isEmpty() ? null : adKpis; }
  public void setAdKpis(List<Kpi> v) { this.adKpis = v; }
  public List<String> getAdIds() { return adIds == null || adIds.isEmpty() ? null : adIds; }
  public void setAdIds(List<String> v) { this.adIds = v; }
  public List<String> getAdSetIds() { return adSetIds == null || adSetIds.isEmpty() ? null : adSetIds; }
  public void setAdSetIds(List<String> v) { this.adSetIds = v; }

  public String getStudyId() { return studyId; }
  public void setStudyId(String v) { this.studyId = v; }
  public String getLaunchedAt() { return launchedAt; }
  public void setLaunchedAt(String v) { this.launchedAt = v; }
  public String getStatus() { return status; }
  public void setStatus(String v) { this.status = v; }
  public HypothesisData getHypothesis() { return nullIfEmpty(hypothesis); }
  public void setHypothesis(HypothesisData v) { this.hypothesis = v; }
}
