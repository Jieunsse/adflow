package ai.adflow.api.workspace;

import ai.adflow.api.security.Role;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * 사람 한 명의 소속과 역할. 이메일당 1행이라 한 사람은 워크스페이스 하나에만 속한다 (1차).
 *
 * <p>내보내도 행을 지우지 않고 removedAt 을 찍는다. 지우면 다음 로그인에서 새 워크스페이스가
 * 만들어져, 내보낸 사람이 막히지 않고 빈 공간으로 들어온다.
 */
@Entity
@Table(name = "members")
public class Member {

  @Id private String email;

  @Column(name = "workspace_id", nullable = false)
  private String workspaceId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private Role role;

  @Column(name = "joined_at", nullable = false)
  private Instant joinedAt;

  /** 고객 역할만 쓴다. 그 고객이 볼 수 있는 브랜드(브랜드 프로필 id) 하나다. */
  @Column(name = "brand_profile_id")
  private String brandProfileId;

  @Column(name = "removed_at")
  private Instant removedAt;

  protected Member() {}

  public Member(String email, String workspaceId, Role role, Instant joinedAt) {
    this.email = email;
    this.workspaceId = workspaceId;
    this.role = role;
    this.joinedAt = joinedAt;
  }

  public boolean isRemoved() { return removedAt != null; }

  public String getEmail() { return email; }
  public String getWorkspaceId() { return workspaceId; }
  public Role getRole() { return role; }
  public void setRole(Role v) { this.role = v; }
  public Instant getJoinedAt() { return joinedAt; }
  public String getBrandProfileId() { return brandProfileId; }
  public void setBrandProfileId(String v) { this.brandProfileId = v; }
  public Instant getRemovedAt() { return removedAt; }
  public void setRemovedAt(Instant v) { this.removedAt = v; }
}
