package ai.adflow.api.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/**
 * 앱 알림 한 건 (정책서 17절). 서버에 저장해 화면을 닫아 둔 동안 생긴 알림도 다음에 보인다.
 * (받는 사람, dedupeKey) 가 같으면 한 번만 만든다 — 같은 일로 같은 사람에게 두 번 가지 않는다.
 */
@Entity
@Table(
    name = "notifications",
    uniqueConstraints = @UniqueConstraint(columnNames = {"recipient_email", "dedupe_key"}))
public class Notification {

  @Id private String id;

  @Column(name = "recipient_email", nullable = false)
  private String recipientEmail;

  @Column(name = "workspace_id", nullable = false)
  private String workspaceId;

  @Column(nullable = false)
  private String kind;

  @Column(nullable = false, length = 300)
  private String message;

  private String link;

  @Column(name = "dedupe_key", nullable = false)
  private String dedupeKey;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "read_at")
  private Instant readAt;

  protected Notification() {}

  public Notification(
      String id, String recipientEmail, String workspaceId, String kind, String message,
      String link, String dedupeKey, Instant createdAt) {
    this.id = id;
    this.recipientEmail = recipientEmail;
    this.workspaceId = workspaceId;
    this.kind = kind;
    this.message = message;
    this.link = link;
    this.dedupeKey = dedupeKey;
    this.createdAt = createdAt;
  }

  public String getId() { return id; }
  public String getKind() { return kind; }
  public String getMessage() { return message; }
  public String getLink() { return link; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getReadAt() { return readAt; }
}
