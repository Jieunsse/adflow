package ai.adflow.api.store.relaunch;

import ai.adflow.api.store.OwnerScoped;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * TS: apps/web/src/shared/lib/autoRelaunch.ts 의 AutoRelaunchEntry.
 *
 * 식별자의 와이어 이름이 campaignId 다. 저장은 OwnerScoped.id 를 그대로 쓰고
 * @JsonIgnoreProperties("id") 로 부모 필드를 감춘 뒤 접근자 쌍으로 다른 이름을 붙인다.
 * 값을 두 번 들고 있지 않으므로 어긋날 여지가 없다.
 */
@Entity
@Table(name = "auto_relaunch_states")
@JsonIgnoreProperties("id")
public class AutoRelaunchState extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private Boolean enabled;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "cycle_count")
  private Integer cycleCount;

  @Column(name = "parent_campaign_id")
  private String parentCampaignId;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "created_at")
  private String createdAt;

  @Column(name = "domain_updated_at")
  private String domainUpdatedAt;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @JsonProperty("campaignId")
  public String getCampaignId() { return getId(); }

  @JsonProperty("campaignId")
  public void setCampaignId(String v) { setId(v); }

  public Boolean getEnabled() { return enabled; }
  public void setEnabled(Boolean v) { this.enabled = v; }
  public Integer getCycleCount() { return cycleCount; }
  public void setCycleCount(Integer v) { this.cycleCount = v; }
  public String getParentCampaignId() { return parentCampaignId; }
  public void setParentCampaignId(String v) { this.parentCampaignId = v; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @JsonProperty("updatedAt")
  public String getDomainUpdatedAt() { return domainUpdatedAt; }

  @JsonProperty("updatedAt")
  public void setDomainUpdatedAt(String v) { this.domainUpdatedAt = v; }
}
