package ai.adflow.api.internal.workspace;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import ai.adflow.api.store.JsonNodeConverter;

@Entity
@Table(name = "workspace_meta_target_audit")
public class WorkspaceMetaTargetAudit {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private String actor;

  @Column(nullable = false)
  private Instant changedAt;

  @Convert(converter = JsonNodeConverter.class)
  @Column(columnDefinition = "text", nullable = false)
  private JsonNode beforeState;

  @Convert(converter = JsonNodeConverter.class)
  @Column(columnDefinition = "text", nullable = false)
  private JsonNode afterState;

  public Long getId() { return id; }
  public String getActor() { return actor; }
  public void setActor(String v) { this.actor = v; }
  public Instant getChangedAt() { return changedAt; }
  public void setChangedAt(Instant v) { this.changedAt = v; }
  public JsonNode getBeforeState() { return beforeState; }
  public void setBeforeState(JsonNode v) { this.beforeState = v; }
  public JsonNode getAfterState() { return afterState; }
  public void setAfterState(JsonNode v) { this.afterState = v; }
}
