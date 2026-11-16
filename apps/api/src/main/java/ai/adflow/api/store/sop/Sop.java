package ai.adflow.api.store.sop;

import ai.adflow.api.store.JsonNodeConverter;
import ai.adflow.api.store.OwnerScoped;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import tools.jackson.databind.JsonNode;

/** TS: apps/web/src/features/sop/model/useSopStorage.ts 의 Sop 과 필드 1:1. */
@Entity
@Table(name = "sops")
public class Sop extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String name;

  @Column(length = 2000)
  private String description;

  /**
   * SopSection[] — type 마다 data 형태가 다른 판별 유니온이라 관계형으로 펼치지 않는다.
   * BrandProfile.policy 와 같은 처방이다(단계 2 의 의도된 편차 #1).
   */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @ArraySchema(schema = @Schema(implementation = Object.class))
  @Convert(converter = JsonNodeConverter.class)
  @Column(name = "sections", columnDefinition = "text")
  private JsonNode sections;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "created_at")
  private String createdAt;

  /**
   * 도메인의 updatedAt. OwnerScoped.updatedAt(서버 전용 정렬 키)과 이름이 겹치므로
   * 자바 필드명을 달리하고 와이어 이름만 updatedAt 으로 맞춘다.
   */
  @Column(name = "domain_updated_at")
  private String domainUpdatedAt;

  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public String getDescription() { return description; }
  public void setDescription(String v) { this.description = v; }
  public JsonNode getSections() { return sections; }
  public void setSections(JsonNode v) { this.sections = v; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @JsonProperty("updatedAt")
  public String getDomainUpdatedAt() { return domainUpdatedAt; }

  @JsonProperty("updatedAt")
  public void setDomainUpdatedAt(String v) { this.domainUpdatedAt = v; }
}
