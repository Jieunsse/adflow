package ai.adflow.api.store.creator;

import ai.adflow.api.store.OwnerScoped;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

/** TS: apps/web/src/entities/creator/model.ts 의 Creator 와 필드 1:1. */
@Entity
@Table(name = "creators")
public class Creator extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String handle;

  @Enumerated(EnumType.STRING)
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private CreatorPlatform platform;

  @Column(name = "display_name")
  private String displayName;

  @Column(name = "avatar_url", length = 2000)
  private String avatarUrl;

  // @OrderColumn 이 없으면 순서가 보장되지 않는다. 화면이 입력 순서를 그대로 보여주므로 필요하다.
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "creator_categories", joinColumns = @JoinColumn(name = "creator_id"))
  @Column(name = "category")
  @OrderColumn(name = "position")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private List<String> category = new ArrayList<>();

  @Column(name = "follower_count")
  private Integer followerCount;

  @Column(length = 2000)
  private String note;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(
      name = "creator_performances",
      joinColumns = @JoinColumn(name = "creator_id"))
  @OrderColumn(name = "position")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private List<Performance> performanceHistory = new ArrayList<>();

  @Column(name = "created_at")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String createdAt;

  public String getHandle() { return handle; }
  public void setHandle(String v) { this.handle = v; }
  public CreatorPlatform getPlatform() { return platform; }
  public void setPlatform(CreatorPlatform v) { this.platform = v; }
  public String getDisplayName() { return displayName; }
  public void setDisplayName(String v) { this.displayName = v; }
  public String getAvatarUrl() { return avatarUrl; }
  public void setAvatarUrl(String v) { this.avatarUrl = v; }
  // TS 의 category: string[] 는 required 다. null 을 넣지 않는다 — 프론트가 .map 을 바로 부른다.
  public List<String> getCategory() { return category; }
  public void setCategory(List<String> v) { this.category = v == null ? new ArrayList<>() : v; }
  public Integer getFollowerCount() { return followerCount; }
  public void setFollowerCount(Integer v) { this.followerCount = v; }
  public String getNote() { return note; }
  public void setNote(String v) { this.note = v; }
  public List<Performance> getPerformanceHistory() { return performanceHistory; }
  public void setPerformanceHistory(List<Performance> v) {
    this.performanceHistory = v == null ? new ArrayList<>() : v;
  }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }
}
