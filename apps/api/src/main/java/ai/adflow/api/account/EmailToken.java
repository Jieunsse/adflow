package ai.adflow.api.account;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** 메일 속 링크 한 번 쓰는 표. 원래 값은 메일에만 있고 여기에는 해시만 둔다 — DB 가 새도 링크를 못 만든다. */
@Entity
@Table(name = "email_tokens")
public class EmailToken {

  @Id
  @Column(name = "token_hash")
  private String tokenHash;

  @Column(nullable = false)
  private String email;

  /** verify(가입 인증, 24시간) · reset(비밀번호 재설정, 30분) */
  @Column(nullable = false)
  private String purpose;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @Column(name = "used_at")
  private Instant usedAt;

  protected EmailToken() {}

  public EmailToken(String tokenHash, String email, String purpose, Instant expiresAt) {
    this.tokenHash = tokenHash;
    this.email = email;
    this.purpose = purpose;
    this.expiresAt = expiresAt;
  }

  public String getEmail() { return email; }
  public String getPurpose() { return purpose; }
  public Instant getExpiresAt() { return expiresAt; }
  public Instant getUsedAt() { return usedAt; }
  public void setUsedAt(Instant v) { this.usedAt = v; }
}
