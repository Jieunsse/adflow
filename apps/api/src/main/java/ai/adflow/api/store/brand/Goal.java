package ai.adflow.api.store.brand;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * TS: Goal. leads 가 중첩 컬렉션이라 @Embeddable 로는 안 되고 엔티티여야 한다.
 *
 * 도메인 id 는 클라이언트가 만든 문자열이고 owner 간 유일성이 보장되지 않는다. PK 로 쓰면
 * 다른 사용자의 같은 id 와 충돌하므로 대리 키를 따로 둔다 — 와이어에는 노출하지 않는다.
 */
@Entity
@Table(name = "brand_profile_goals")
public class Goal {

  @JsonIgnore
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long pk;

  @Column(name = "goal_id")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String id;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String name;

  @Embedded
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private LagTarget lag;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "brand_profile_goal_leads", joinColumns = @JoinColumn(name = "goal_pk"))
  @OrderColumn(name = "position")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private List<LeadMetric> leads = new ArrayList<>();

  @Column(name = "period_days")
  private Integer periodDays;

  @Column(name = "created_at")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String createdAt;

  public String getId() { return id; }
  public void setId(String v) { this.id = v; }
  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public LagTarget getLag() { return lag; }
  public void setLag(LagTarget v) { this.lag = v; }
  public List<LeadMetric> getLeads() { return leads; }
  public void setLeads(List<LeadMetric> v) { this.leads = v == null ? new ArrayList<>() : v; }
  public Integer getPeriodDays() { return periodDays; }
  public void setPeriodDays(Integer v) { this.periodDays = v; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }
}
