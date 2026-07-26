package ai.adflow.api.store;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;

/**
 * Synced Store 엔티티의 공통 바탕.
 *
 * 엔티티가 곧 와이어 타입이다(와이어 형태 동결). 서버 전용 필드는 @JsonIgnore 로 가린다 —
 * ownerKey 를 노출하면 TS 타입에 없는 필드가 응답에 섞이고, updatedAt 은 정렬용 내부 값이다.
 *
 * id 는 클라이언트가 만든 문자열이다(cre_·bp_ 접두). 서버가 생성하지 않는다.
 */
@MappedSuperclass
public abstract class OwnerScoped {

  @Id private String id;

  @JsonIgnore
  @Column(name = "owner_key", nullable = false)
  private String ownerKey;

  /** 목록 정렬 기준. Supabase 의 synced_at desc 순서를 그대로 승계한다. */
  @JsonIgnore
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public String getId() { return id; }
  public void setId(String v) { this.id = v; }
  public String getOwnerKey() { return ownerKey; }
  public void setOwnerKey(String v) { this.ownerKey = v; }
  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant v) { this.updatedAt = v; }
}
