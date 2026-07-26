package ai.adflow.api.store.product;

import ai.adflow.api.store.OwnerScoped;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * TS: apps/web/src/shared/lib/products.ts 의 ProductEntry 와 필드 1:1.
 *
 * <p>Supabase 시절엔 owner 컬럼이 없어 brandProfileId 만 알면 남의 제품이 보였다. OwnerScoped 를
 * 상속해 한 겹 더 거른다(단계 4 의 의도된 편차 #2).
 */
@Entity
@Table(name = "products")
public class Product extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "brand_profile_id", nullable = false)
  private String brandProfileId;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String name;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(length = 2000)
  private String description;

  /** 버킷 상대 경로다(product-images/{bp}/{id}.png). 노출 URL 은 Next 라우트가 조립한다. */
  @Column(name = "image_url", length = 1024)
  private String imageUrl;

  private String price;

  @Column(name = "target_url", length = 1024)
  private String targetUrl;

  /** epoch ms. 클라가 만든 값이라 서버가 덮어쓰지 않는다. */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "created_at", nullable = false)
  private Long createdAt;

  public String getBrandProfileId() { return brandProfileId; }
  public void setBrandProfileId(String v) { this.brandProfileId = v; }
  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public String getDescription() { return description; }
  public void setDescription(String v) { this.description = v; }
  public String getImageUrl() { return imageUrl; }
  public void setImageUrl(String v) { this.imageUrl = v; }
  public String getPrice() { return price; }
  public void setPrice(String v) { this.price = v; }
  public String getTargetUrl() { return targetUrl; }
  public void setTargetUrl(String v) { this.targetUrl = v; }
  public Long getCreatedAt() { return createdAt; }
  public void setCreatedAt(Long v) { this.createdAt = v; }
}
