package ai.adflow.api.connection;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * 사용자당 Notion 연결 1건 (ADR-043). 단계 4 에서 유예했다가 단계 7 에 옮겼다.
 *
 * <p>액세스 토큰은 컬럼 암호화한다 — MetaConnection 과 같은 처방이다. Supabase 시절엔 평문이었다.
 *
 * <p>userKey 는 NextAuth 의 sub/email 이다. 라우트가 세션에서 해석해 넘긴다.
 */
@Entity
@Table(name = "notion_connections")
public class NotionConnection {

  @JsonIgnore
  @Id
  @Column(name = "user_key")
  private String userKey;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Convert(converter = EncryptedStringConverter.class)
  @Column(name = "access_token", length = 2048)
  private String accessToken;

  @Column(name = "bot_id")
  private String botId;

  @Column(name = "workspace_id")
  private String workspaceId;

  @Column(name = "workspace_name")
  private String workspaceName;

  @Column(name = "workspace_icon", length = 2048)
  private String workspaceIcon;

  @JsonIgnore
  @Column(name = "updated_at")
  private Instant updatedAt;

  public String getUserKey() { return userKey; }
  public void setUserKey(String v) { this.userKey = v; }
  public String getAccessToken() { return accessToken; }
  public void setAccessToken(String v) { this.accessToken = v; }
  public String getBotId() { return botId; }
  public void setBotId(String v) { this.botId = v; }
  public String getWorkspaceId() { return workspaceId; }
  public void setWorkspaceId(String v) { this.workspaceId = v; }
  public String getWorkspaceName() { return workspaceName; }
  public void setWorkspaceName(String v) { this.workspaceName = v; }
  public String getWorkspaceIcon() { return workspaceIcon; }
  public void setWorkspaceIcon(String v) { this.workspaceIcon = v; }
  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant v) { this.updatedAt = v; }
}
