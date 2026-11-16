package ai.adflow.api.client;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 상담 메모 — 시간순으로 쌓이고 고칠 수 없다. 틀리면 새 메모로 바로잡는다 (정책서 27절). */
@Entity
@Table(name = "client_memos")
public class ClientMemo {

  @Id private String id;

  @Column(name = "client_id", nullable = false)
  private String clientId;

  @Column(name = "workspace_id", nullable = false)
  private String workspaceId;

  @Column(nullable = false)
  private String author;

  @Column(nullable = false, length = 4000)
  private String body;

  @Column(name = "created_at", nullable = false)
  private String createdAt;

  protected ClientMemo() {}

  public ClientMemo(String id, String clientId, String workspaceId, String author, String body, String createdAt) {
    this.id = id;
    this.clientId = clientId;
    this.workspaceId = workspaceId;
    this.author = author;
    this.body = body;
    this.createdAt = createdAt;
  }

  public String getId() { return id; }
  public String getAuthor() { return author; }
  public String getBody() { return body; }
  public String getCreatedAt() { return createdAt; }
}
