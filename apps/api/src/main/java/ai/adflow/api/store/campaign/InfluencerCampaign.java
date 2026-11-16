package ai.adflow.api.store.campaign;

import ai.adflow.api.store.OwnerScoped;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

/** TS: InfluencerCampaign. Meta Campaign 과 별개 엔티티다 (ADR-065 §1). */
@Entity
@Table(name = "influencer_campaigns")
public class InfluencerCampaign extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String name;

  /** Meta objective 가 아니라 자유 텍스트/칩이다. enum 으로 좁히지 않는다. */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String goal;

  @Column(name = "product_id")
  private String productId;

  private Double budget;

  @Column(name = "start_date")
  private String startDate;

  @Column(name = "end_date")
  private String endDate;

  @Column(name = "brand_profile_id")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String brandProfileId;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "campaign_entries", joinColumns = @JoinColumn(name = "campaign_id"))
  @OrderColumn(name = "position")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private List<CampaignEntry> entries = new ArrayList<>();

  @Column(name = "created_at")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String createdAt;

  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public String getGoal() { return goal; }
  public void setGoal(String v) { this.goal = v; }
  public String getProductId() { return productId; }
  public void setProductId(String v) { this.productId = v; }
  public Double getBudget() { return budget; }
  public void setBudget(Double v) { this.budget = v; }
  public String getStartDate() { return startDate; }
  public void setStartDate(String v) { this.startDate = v; }
  public String getEndDate() { return endDate; }
  public void setEndDate(String v) { this.endDate = v; }
  public String getBrandProfileId() { return brandProfileId; }
  public void setBrandProfileId(String v) { this.brandProfileId = v; }
  // TS 의 entries: CampaignEntry[] 는 required 다. isCampaignCompleted 가 .every 를 바로 부른다.
  public List<CampaignEntry> getEntries() { return entries; }
  public void setEntries(List<CampaignEntry> v) { this.entries = v == null ? new ArrayList<>() : v; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }
}
