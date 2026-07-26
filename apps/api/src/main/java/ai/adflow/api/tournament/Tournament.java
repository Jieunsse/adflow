package ai.adflow.api.tournament;

import ai.adflow.api.store.OwnerScoped;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;

/**
 * A/B 토너먼트 애그리거트 (ADR-032/037/038/044/054/061). TS: engine.ts 의 Tournament, 29필드.
 *
 * <p>Supabase 시절엔 통째로 data jsonb 였다. 정규화하면서 얻는 것 둘 — 폴러와 UI 가 같은 행을 동시에
 * 고칠 때 통짜 덮어쓰기로 조용히 유실되던 경합이 사라지고, delivery 의 Meta 장기 토큰이 평문에서
 * 암호화 컬럼으로 옮겨간다.
 *
 * <p><b>설계 대비 의도된 편차</b> — 설계 §5 는 tour_variants·hypotheses 를 별도 테이블로 적었다.
 * 둘 다 부모와 1:1 로 붙어 있고 독립 수명이 없으며 단독 조회가 없다. @Embedded 로 부모 테이블에
 * 펼치면 같은 컬럼이 나오고 조인이 하나 준다. Ledger 투영은 ADR-047 대로 라운드에서 평탄화한다.
 */
@Entity
@Table(name = "tournaments")
public class Tournament extends OwnerScoped {

  /** 크리에이티브 변형. TS: TourVariant. 라운드에서도 같은 모양으로 재사용한다. */
  @Embeddable
  public static class Variant {
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(length = 1000)
    private String headline;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "primary_text", length = 4000)
    private String primaryText;

    @Column(name = "image_url", length = 2048)
    private String imageUrl;

    public String getHeadline() { return headline; }
    public void setHeadline(String v) { this.headline = v; }
    public String getPrimaryText() { return primaryText; }
    public void setPrimaryText(String v) { this.primaryText = v; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String v) { this.imageUrl = v; }
  }

  /** 자동충전 (ADR-061). opt-in — 봉투 소진 시 hardCap 까지 자동 충전한다. */
  @Embeddable
  public static class AutoRefill {
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "auto_refill_add_budget")
    private Double addBudget;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    @Column(name = "auto_refill_hard_cap")
    private Double hardCap;

    public Double getAddBudget() { return addBudget; }
    public void setAddBudget(Double v) { this.addBudget = v; }
    public Double getHardCap() { return hardCap; }
    public void setHardCap(Double v) { this.hardCap = v; }
  }

  /** 자동 봉투 (ADR-054/061). 소진 = 사람이 결정할 유일한 지점. */
  @Embeddable
  public static class Envelope {
    @Column(name = "envelope_total_budget")
    private Double totalBudget;

    @Column(name = "envelope_target_date")
    private String targetDate;

    @Embedded private AutoRefill autoRefill;

    @Column(name = "envelope_stop_on_defend_streak")
    private Integer stopOnDefendStreak;

    public Double getTotalBudget() { return totalBudget; }
    public void setTotalBudget(Double v) { this.totalBudget = v; }
    public String getTargetDate() { return targetDate; }
    public void setTargetDate(String v) { this.targetDate = v; }

    /**
     * addBudget·hardCap 이 둘 다 없으면 autoRefill 자체가 없는 것이다.
     *
     * <p>Hibernate 는 전 필드가 null 인 임베더블을 null 이 아니라 빈 객체로 되살릴 수 있다 —
     * 그대로 두면 `{}` 가 와이어에 나가 TS 의 optional 과 어긋난다(단계 3 의 @ElementCollection 과
     * 같은 부류의 함정이다).
     */
    public AutoRefill getAutoRefill() {
      if (autoRefill == null) return null;
      return autoRefill.getAddBudget() == null && autoRefill.getHardCap() == null ? null : autoRefill;
    }

    public void setAutoRefill(AutoRefill v) { this.autoRefill = v; }
    public Integer getStopOnDefendStreak() { return stopOnDefendStreak; }
    public void setStopOnDefendStreak(Integer v) { this.stopOnDefendStreak = v; }
  }

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "brand_profile_id", nullable = false)
  private String brandProfileId;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "product_id")
  private String productId;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "product_name")
  private String productName;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String tone;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String objective;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "daily_budget")
  private Double dailyBudget;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Embedded
  @AttributeOverrides({
    @AttributeOverride(name = "headline", column = @Column(name = "champion_headline", length = 1000)),
    @AttributeOverride(name = "primaryText", column = @Column(name = "champion_primary_text", length = 4000)),
    @AttributeOverride(name = "imageUrl", column = @Column(name = "champion_image_url", length = 2048))
  })
  private Variant champion;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "champion_ctr")
  private Double championCtr;

  @Column(name = "champion_source")
  private String championSource;

  @Column(name = "champion_source_name")
  private String championSourceName;

  @Column(name = "champion_confirmed")
  private Boolean championConfirmed;

  @Embedded
  @AttributeOverrides({
    @AttributeOverride(name = "headline", column = @Column(name = "pending_headline", length = 1000)),
    @AttributeOverride(name = "primaryText", column = @Column(name = "pending_primary_text", length = 4000)),
    @AttributeOverride(name = "imageUrl", column = @Column(name = "pending_image_url", length = 2048))
  })
  private Variant pendingChallenger;

  @Embedded private TourRound.HypothesisData pendingHypothesis;

  @Embedded private Envelope envelope;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(
      name = "tournament_prohibited_words",
      joinColumns = @JoinColumn(name = "tournament_id"))
  @Column(name = "word")
  @OrderColumn(name = "position")
  private List<String> prohibitedWords;

  @Column(name = "brand_description", length = 4000)
  private String brandDescription;

  @Column(name = "product_description", length = 4000)
  private String productDescription;

  @Column(name = "variation_intensity")
  private String variationIntensity;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "axis_cursor")
  private Integer axisCursor;

  /** 라운드 순서가 곧 의미다(1-based index) — @OrderColumn 으로 순서를 영속한다. */
  @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
  @JoinColumn(name = "tournament_id")
  @OrderColumn(name = "position")
  private List<TourRound> rounds = new ArrayList<>();

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "spent_budget")
  private Double spentBudget;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String status;

  @Column(name = "completion_reason")
  private String completionReason;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "created_at")
  private String createdAt;

  @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
  @JoinColumn(name = "delivery_id")
  private TournamentDelivery delivery;

  @Column(name = "last_error", length = 2000)
  private String lastError;

  /**
   * ADR-054 — manual-n 은 폐기됐고 값은 항상 auto 다. 레거시 행을 읽을 때 흡수하지 않으면 폴러가
   * mode=="auto" 만 진행하므로 옛 토너먼트가 조용히 멈춘다(supabase-store 의 normalize 와 같은 일).
   */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = "auto")
  @JsonProperty("mode")
  public String getMode() {
    return "auto";
  }

  @JsonProperty("mode")
  public void setMode(String ignored) {
    // 저장하지 않는다 — 값이 하나뿐이라 컬럼을 둘 이유가 없다.
  }

  public String getBrandProfileId() { return brandProfileId; }
  public void setBrandProfileId(String v) { this.brandProfileId = v; }
  public String getProductId() { return productId; }
  public void setProductId(String v) { this.productId = v; }
  public String getProductName() { return productName; }
  public void setProductName(String v) { this.productName = v; }
  public String getTone() { return tone; }
  public void setTone(String v) { this.tone = v; }
  public String getObjective() { return objective; }
  public void setObjective(String v) { this.objective = v; }
  public Double getDailyBudget() { return dailyBudget; }
  public void setDailyBudget(Double v) { this.dailyBudget = v; }
  public Variant getChampion() { return champion; }
  public void setChampion(Variant v) { this.champion = v; }
  public Double getChampionCtr() { return championCtr; }
  public void setChampionCtr(Double v) { this.championCtr = v; }
  public String getChampionSource() { return championSource; }
  public void setChampionSource(String v) { this.championSource = v; }
  public String getChampionSourceName() { return championSourceName; }
  public void setChampionSourceName(String v) { this.championSourceName = v; }
  public Boolean getChampionConfirmed() { return championConfirmed; }
  public void setChampionConfirmed(Boolean v) { this.championConfirmed = v; }

  /** 전 필드가 null 이면 pendingChallenger 자체가 없는 것이다 (Envelope.getAutoRefill 과 같은 이유). */
  public Variant getPendingChallenger() {
    if (pendingChallenger == null) return null;
    return pendingChallenger.getHeadline() == null && pendingChallenger.getPrimaryText() == null
        ? null
        : pendingChallenger;
  }

  public void setPendingChallenger(Variant v) { this.pendingChallenger = v; }
  public TourRound.HypothesisData getPendingHypothesis() { return TourRound.nullIfEmpty(pendingHypothesis); }
  public void setPendingHypothesis(TourRound.HypothesisData v) { this.pendingHypothesis = v; }

  /** 전 필드가 null 이면 envelope 자체가 없다. */
  public Envelope getEnvelope() {
    if (envelope == null) return null;
    boolean empty =
        envelope.getTotalBudget() == null
            && envelope.getTargetDate() == null
            && envelope.getAutoRefill() == null
            && envelope.getStopOnDefendStreak() == null;
    return empty ? null : envelope;
  }

  public void setEnvelope(Envelope v) { this.envelope = v; }

  /** 빈 컬렉션은 null 로 접는다 — TS 의 optional(키 부재)과 맞춘다(단계 3 의 Persona 와 같은 처방). */
  public List<String> getProhibitedWords() {
    return prohibitedWords == null || prohibitedWords.isEmpty() ? null : prohibitedWords;
  }

  public void setProhibitedWords(List<String> v) { this.prohibitedWords = v; }
  public String getBrandDescription() { return brandDescription; }
  public void setBrandDescription(String v) { this.brandDescription = v; }
  public String getProductDescription() { return productDescription; }
  public void setProductDescription(String v) { this.productDescription = v; }
  public String getVariationIntensity() { return variationIntensity; }
  public void setVariationIntensity(String v) { this.variationIntensity = v; }
  public Integer getAxisCursor() { return axisCursor; }
  public void setAxisCursor(Integer v) { this.axisCursor = v; }

  /** rounds 는 required 다 — null 로 뭉개지면 화면이 .filter 에서 깨진다. */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  public List<TourRound> getRounds() { return rounds == null ? List.of() : rounds; }

  public void setRounds(List<TourRound> v) { this.rounds = v == null ? new ArrayList<>() : v; }
  public Double getSpentBudget() { return spentBudget; }
  public void setSpentBudget(Double v) { this.spentBudget = v; }
  public String getStatus() { return status; }
  public void setStatus(String v) { this.status = v; }
  public String getCompletionReason() { return completionReason; }
  public void setCompletionReason(String v) { this.completionReason = v; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }
  public TournamentDelivery getDelivery() { return delivery; }
  public void setDelivery(TournamentDelivery v) { this.delivery = v; }
  public String getLastError() { return lastError; }
  public void setLastError(String v) { this.lastError = v; }
}
