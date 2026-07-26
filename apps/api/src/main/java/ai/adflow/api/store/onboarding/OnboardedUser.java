package ai.adflow.api.store.onboarding;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * 온보딩을 마친 소유자. 있으면 완료, 없으면 미완료 — 행 자체가 곧 값이다.
 *
 * <p>OwnerScoped 를 상속하지 않는다. 소유자당 0 또는 1행이라 컬렉션이 아니고, id 가 곧 ownerKey 다.
 */
@Entity
@Table(name = "onboarded_users")
public class OnboardedUser {

  @Id
  @Column(name = "owner_key")
  private String ownerKey;

  @Column(name = "onboarded_at")
  private Instant onboardedAt;

  public String getOwnerKey() { return ownerKey; }
  public void setOwnerKey(String v) { this.ownerKey = v; }
  public Instant getOnboardedAt() { return onboardedAt; }
  public void setOnboardedAt(Instant v) { this.onboardedAt = v; }
}
