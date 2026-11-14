package ai.adflow.api.plan;

import ai.adflow.api.store.OwnerScoped;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * 브랜드 한 곳의 한 달 광고 계획과 총예산 상한 (기능 12, 정책서 11.4). id 는 "{브랜드 프로필 id}_{YYYY-MM}" 이다.
 *
 * <p>승인한 사람·시각은 새 요청이 들어와 다시 결정되기 전까지 지우지 않는다 — 승인 기록은 고칠 수 없다.
 *
 * <p>shortcut: 실험 묶음은 JSON 문자열 한 칸에 담는다. 묶음별로 조회하거나 집계할 일이 생기면 표로 나눈다.
 */
@Entity
@Table(name = "monthly_plans")
public class MonthlyPlan extends OwnerScoped {

  public static final String DRAFT = "draft";
  public static final String REQUESTED = "requested";
  public static final String APPROVED = "approved";
  public static final String REJECTED = "rejected";

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "brand_profile_id", nullable = false)
  private String brandProfileId;

  /** YYYY-MM. */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "plan_month", nullable = false)
  private String month;

  /** draft · requested · approved · rejected */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(nullable = false)
  private String status;

  /** 총예산 상한(원). */
  @Column(name = "budget_cap")
  private Long budgetCap;

  /** [{goal, product, axes, budget}] 를 담은 JSON 배열. */
  @Column(length = 20000)
  private String bundles;

  @Column(name = "message_to_client", length = 1000)
  private String messageToClient;

  @Column(name = "requested_by")
  private String requestedBy;

  @Column(name = "requested_at")
  private String requestedAt;

  @Column(name = "decided_by")
  private String decidedBy;

  @Column(name = "decided_at")
  private String decidedAt;

  @Column(name = "reject_reason", length = 400)
  private String rejectReason;

  public String getBrandProfileId() { return brandProfileId; }
  public void setBrandProfileId(String v) { this.brandProfileId = v; }
  public String getMonth() { return month; }
  public void setMonth(String v) { this.month = v; }
  public String getStatus() { return status; }
  public void setStatus(String v) { this.status = v; }
  public Long getBudgetCap() { return budgetCap; }
  public void setBudgetCap(Long v) { this.budgetCap = v; }
  public String getBundles() { return bundles; }
  public void setBundles(String v) { this.bundles = v; }
  public String getMessageToClient() { return messageToClient; }
  public void setMessageToClient(String v) { this.messageToClient = v; }
  public String getRequestedBy() { return requestedBy; }
  public void setRequestedBy(String v) { this.requestedBy = v; }
  public String getRequestedAt() { return requestedAt; }
  public void setRequestedAt(String v) { this.requestedAt = v; }
  public String getDecidedBy() { return decidedBy; }
  public void setDecidedBy(String v) { this.decidedBy = v; }
  public String getDecidedAt() { return decidedAt; }
  public void setDecidedAt(String v) { this.decidedAt = v; }
  public String getRejectReason() { return rejectReason; }
  public void setRejectReason(String v) { this.rejectReason = v; }
}
