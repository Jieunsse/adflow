package ai.adflow.api.store.material;

import ai.adflow.api.store.OwnerScoped;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * TS: apps/web/src/shared/lib/referenceMaterials.ts 의 ReferenceMaterial 과 필드 1:1.
 *
 * <p>Product 와 같이 owner 스코프를 새로 건다(단계 4 의 의도된 편차 #2).
 */
@Entity
@Table(name = "reference_materials")
public class ReferenceMaterial extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "brand_profile_id", nullable = false)
  private String brandProfileId;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String name;

  /**
   * image|pdf|txt. Java enum 으로 만들지 않는다 — TS 유니온이 진실의 원천이고, 옮기면 목록이 두
   * 곳에 살아 드리프트한다(단계 3 의 goalId 와 같은 판단).
   */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String type;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "mime_type")
  private String mimeType;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "size_bytes")
  private Long sizeBytes;

  /** 버킷 상대 경로. 게스트 폴백의 data: URL 은 여기까지 오지 않는다(로컬에만 산다). */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "storage_url", length = 1024)
  private String storageUrl;

  /** epoch ms. */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "uploaded_at", nullable = false)
  private Long uploadedAt;

  public String getBrandProfileId() { return brandProfileId; }
  public void setBrandProfileId(String v) { this.brandProfileId = v; }
  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public String getType() { return type; }
  public void setType(String v) { this.type = v; }
  public String getMimeType() { return mimeType; }
  public void setMimeType(String v) { this.mimeType = v; }
  public Long getSizeBytes() { return sizeBytes; }
  public void setSizeBytes(Long v) { this.sizeBytes = v; }
  public String getStorageUrl() { return storageUrl; }
  public void setStorageUrl(String v) { this.storageUrl = v; }
  public Long getUploadedAt() { return uploadedAt; }
  public void setUploadedAt(Long v) { this.uploadedAt = v; }
}
