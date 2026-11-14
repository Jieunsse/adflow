package ai.adflow.api.timelog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 작업 시간 한 건 (기능 15, 정책서 28절). 고객 화면에는 보이지 않는다. */
@Entity
@Table(name = "time_entries")
public class TimeEntry {

  @Id private String id;

  @Column(name = "workspace_id", nullable = false)
  private String workspaceId;

  @Column(name = "member_email", nullable = false)
  private String memberEmail;

  @Column(name = "brand_profile_id", nullable = false)
  private String brandProfileId;

  /** onboarding · monthly_plan · creative · review · launch · report · sales */
  @Column(nullable = false)
  private String stage;

  @Column(nullable = false)
  private Integer minutes;

  /** 한국 날짜 YYYY-MM-DD. */
  @Column(name = "work_date", nullable = false)
  private String workDate;

  public String getId() { return id; }
  public void setId(String v) { this.id = v; }
  public String getWorkspaceId() { return workspaceId; }
  public void setWorkspaceId(String v) { this.workspaceId = v; }
  public String getMemberEmail() { return memberEmail; }
  public void setMemberEmail(String v) { this.memberEmail = v; }
  public String getBrandProfileId() { return brandProfileId; }
  public void setBrandProfileId(String v) { this.brandProfileId = v; }
  public String getStage() { return stage; }
  public void setStage(String v) { this.stage = v; }
  public Integer getMinutes() { return minutes; }
  public void setMinutes(Integer v) { this.minutes = v; }
  public String getWorkDate() { return workDate; }
  public void setWorkDate(String v) { this.workDate = v; }
}
