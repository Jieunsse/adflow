package ai.adflow.api.internal.ig;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 인스타 DM 캐시. Meta Graph 가 진실의 원천이고 이 테이블은 재연결 시 이력을 되살리는 씨앗이다.
 *
 * <p>소유자 컬럼이 없다 — webhook 이 세션 없이 쓴다. 대신 igUserId 가 사실상 소유자 키라
 * 읽기를 항상 igUserId 로 거른다(단계 4 의 의도된 편차 #3).
 *
 * <p>id 는 Meta 의 message id(mid). 같은 메시지를 인박스 씨앗과 스레드 열람이 두 번 넣으므로
 * PK 가 곧 중복 제거 장치다.
 */
@Entity
@Table(name = "ig_messages")
public class IgMessage {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Id
  private String id;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "ig_user_id", nullable = false)
  private String igUserId;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "conversation_id", nullable = false)
  private String conversationId;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "participant_id", nullable = false)
  private String participantId;

  @Column(name = "participant_handle")
  private String participantHandle;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "from_me", nullable = false)
  private Boolean fromMe;

  @Column(name = "text", length = 4000)
  private String text;

  @Column(name = "attachment_url", length = 2048)
  private String attachmentUrl;

  /** ISO 문자열. 화면이 그대로 쓴다 — 서버가 파싱하지 않는다. */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "created_at", nullable = false)
  private String createdAt;

  public String getId() { return id; }
  public void setId(String v) { this.id = v; }
  public String getIgUserId() { return igUserId; }
  public void setIgUserId(String v) { this.igUserId = v; }
  public String getConversationId() { return conversationId; }
  public void setConversationId(String v) { this.conversationId = v; }
  public String getParticipantId() { return participantId; }
  public void setParticipantId(String v) { this.participantId = v; }
  public String getParticipantHandle() { return participantHandle; }
  public void setParticipantHandle(String v) { this.participantHandle = v; }
  public Boolean getFromMe() { return fromMe; }
  public void setFromMe(Boolean v) { this.fromMe = v; }
  public String getText() { return text; }
  public void setText(String v) { this.text = v; }
  public String getAttachmentUrl() { return attachmentUrl; }
  public void setAttachmentUrl(String v) { this.attachmentUrl = v; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }
}
