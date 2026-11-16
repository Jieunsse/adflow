package ai.adflow.api.account;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * 고객의 이메일·비밀번호 계정 (정책서 3.1). 비밀번호는 되돌릴 수 없는 해시(BCrypt)로만 둔다. 어느 브랜드를 볼지는
 * 여기가 아니라 구성원(Member, 고객 역할)이 정한다 — 이메일이 같으면 어떤 방법으로 들어와도 같은 사람이다.
 */
@Entity
@Table(name = "client_accounts")
public class ClientAccount {

  @Id private String email;

  @Column(name = "password_hash", nullable = false)
  private String passwordHash;

  @Column(name = "verified_at")
  private Instant verifiedAt;

  @Column(name = "failed_count", nullable = false)
  private int failedCount;

  @Column(name = "locked_until")
  private Instant lockedUntil;

  @Column(name = "agreed_at", nullable = false)
  private Instant agreedAt;

  @Column(name = "marketing_opt_in", nullable = false)
  private boolean marketingOptIn;

  protected ClientAccount() {}

  public ClientAccount(String email, String passwordHash, Instant agreedAt, boolean marketingOptIn) {
    this.email = email;
    this.passwordHash = passwordHash;
    this.agreedAt = agreedAt;
    this.marketingOptIn = marketingOptIn;
  }

  public String getEmail() { return email; }
  public String getPasswordHash() { return passwordHash; }
  public void setPasswordHash(String v) { this.passwordHash = v; }
  public Instant getVerifiedAt() { return verifiedAt; }
  public void setVerifiedAt(Instant v) { this.verifiedAt = v; }
  public int getFailedCount() { return failedCount; }
  public void setFailedCount(int v) { this.failedCount = v; }
  public Instant getLockedUntil() { return lockedUntil; }
  public void setLockedUntil(Instant v) { this.lockedUntil = v; }
  public void setAgreedAt(Instant v) { this.agreedAt = v; }
  public void setMarketingOptIn(boolean v) { this.marketingOptIn = v; }
}
