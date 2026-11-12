package ai.adflow.api.workspace;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** 브랜드·사람·기록이 속하는 공간 (정책서 1절). 저장 데이터의 owner_key 가 이 id 다. */
@Entity
@Table(name = "workspaces")
public class Workspace {

  @Id private String id;

  @Column(nullable = false)
  private String name;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  protected Workspace() {}

  public Workspace(String id, String name, Instant createdAt) {
    this.id = id;
    this.name = name;
    this.createdAt = createdAt;
  }

  public String getId() { return id; }
  public String getName() { return name; }
  public Instant getCreatedAt() { return createdAt; }
}
