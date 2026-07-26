package ai.adflow.api.store.brand;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

/** TS: CopyReference. id 는 클라이언트가 만든 값이지 PK 가 아니다 — 컬렉션 원소라 PK 가 없다. */
@Embeddable
public class CopyReference {

  @Column(name = "reference_id")
  private String id;

  @Column(length = 4000)
  private String text;

  @Enumerated(EnumType.STRING)
  private CopySource source;

  @Column(name = "created_at")
  private String createdAt;

  public String getId() { return id; }
  public void setId(String v) { this.id = v; }
  public String getText() { return text; }
  public void setText(String v) { this.text = v; }
  public CopySource getSource() { return source; }
  public void setSource(CopySource v) { this.source = v; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }
}
