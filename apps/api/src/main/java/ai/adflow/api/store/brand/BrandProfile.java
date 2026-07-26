package ai.adflow.api.store.brand;

import ai.adflow.api.store.JsonNodeConverter;
import ai.adflow.api.store.OwnerScoped;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.media.Schema;

/** TS: apps/web/src/features/brand-profile/model/useBrandProfileStorage.ts 의 BrandProfileEntry. */
@Entity
@Table(name = "brand_profiles")
public class BrandProfile extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String name;

  @Column(name = "is_default")
  private Boolean isDefault;

  @Column(name = "brand_description", length = 4000)
  private String brandDescription;

  private String tone;

  @Column(name = "brand_voice", length = 4000)
  private String brandVoice;

  @Column(name = "customer_voice_summary", length = 4000)
  private String customerVoiceSummary;

  @Column(name = "image_guide", length = 4000)
  private String imageGuide;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(
      name = "brand_profile_copy_references",
      joinColumns = @JoinColumn(name = "brand_profile_id"))
  @OrderColumn(name = "position")
  private List<CopyReference> copyReferences = new ArrayList<>();

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(
      name = "brand_profile_proof_points",
      joinColumns = @JoinColumn(name = "brand_profile_id"))
  @Column(name = "text", length = 1000)
  @OrderColumn(name = "position")
  private List<String> proofPoints = new ArrayList<>();

  @Column(name = "margin_rate")
  private Double marginRate;

  /** @deprecated goals 로 흡수됐지만 기존 데이터가 있어 와이어에 남겨둔다. */
  @Embedded
  @AttributeOverride(name = "metric", column = @Column(name = "legacy_goal_metric"))
  @AttributeOverride(name = "target", column = @Column(name = "legacy_goal_target"))
  private LagTarget goal;

  @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
  @JoinColumn(name = "brand_profile_id")
  @OrderColumn(name = "position")
  private List<Goal> goals = new ArrayList<>();

  /**
   * SopSection[] — type 마다 data 형태가 다른 판별 유니온이라 관계형으로 펼치지 않는다
   * (설계 §5 대비 의도된 편차). 조회 조건으로 쓰이지 않아 잃는 것이 없다.
   *
   * 스키마를 손으로 적어주지 않으면 springdoc 이 JsonNode 의 빈 프로퍼티(isArray·isNull…)를
   * 그대로 노출해 계약이 거짓말을 한다. 서버가 해석하지 않는 값이므로 "객체 배열"까지만 말한다.
   */
  @ArraySchema(schema = @Schema(implementation = Object.class))
  @Convert(converter = JsonNodeConverter.class)
  @Column(name = "policy", columnDefinition = "text")
  private JsonNode policy;

  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public Boolean getIsDefault() { return isDefault; }
  public void setIsDefault(Boolean v) { this.isDefault = v; }
  public String getBrandDescription() { return brandDescription; }
  public void setBrandDescription(String v) { this.brandDescription = v; }
  public String getTone() { return tone; }
  public void setTone(String v) { this.tone = v; }
  public String getBrandVoice() { return brandVoice; }
  public void setBrandVoice(String v) { this.brandVoice = v; }
  public String getCustomerVoiceSummary() { return customerVoiceSummary; }
  public void setCustomerVoiceSummary(String v) { this.customerVoiceSummary = v; }
  public String getImageGuide() { return imageGuide; }
  public void setImageGuide(String v) { this.imageGuide = v; }
  public List<CopyReference> getCopyReferences() { return copyReferences; }
  public void setCopyReferences(List<CopyReference> v) {
    this.copyReferences = v == null ? new ArrayList<>() : v;
  }
  public List<String> getProofPoints() { return proofPoints; }
  public void setProofPoints(List<String> v) { this.proofPoints = v == null ? new ArrayList<>() : v; }
  public Double getMarginRate() { return marginRate; }
  public void setMarginRate(Double v) { this.marginRate = v; }
  public LagTarget getGoal() { return goal; }
  public void setGoal(LagTarget v) { this.goal = v; }
  public List<Goal> getGoals() { return goals; }
  public void setGoals(List<Goal> v) { this.goals = v == null ? new ArrayList<>() : v; }
  public JsonNode getPolicy() { return policy; }
  public void setPolicy(JsonNode v) { this.policy = v; }
}
