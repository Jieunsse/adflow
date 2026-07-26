package ai.adflow.api.store.library;

import ai.adflow.api.store.OwnerScoped;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** TS: apps/web/src/shared/lib/library.ts 의 LibraryItem 과 필드 1:1. */
@Entity
@Table(name = "library_items")
public class LibraryItem extends OwnerScoped {

  @Column(name = "saved_at", nullable = false)
  private Long savedAt;

  private String brand;

  @Column(length = 1000)
  private String headline;

  // TS 필드명은 primary 지만 PRIMARY 는 SQL 예약어라 컬럼만 바꾼다.
  // Jackson 은 자바 프로퍼티명을 쓰므로 와이어는 그대로 "primary" 다.
  @Column(name = "primary_text", length = 4000)
  private String primary;

  private String tone;

  @Column(name = "tone_label")
  private String toneLabel;

  @Column(name = "cta_id")
  private String ctaId;

  @Column(name = "cta_label")
  private String ctaLabel;

  private String goal;
  private String target;
  private String gradient;

  @Column(length = 2000)
  private String image;

  private String tag;

  public Long getSavedAt() { return savedAt; }
  public void setSavedAt(Long v) { this.savedAt = v; }
  public String getBrand() { return brand; }
  public void setBrand(String v) { this.brand = v; }
  public String getHeadline() { return headline; }
  public void setHeadline(String v) { this.headline = v; }
  public String getPrimary() { return primary; }
  public void setPrimary(String v) { this.primary = v; }
  public String getTone() { return tone; }
  public void setTone(String v) { this.tone = v; }
  public String getToneLabel() { return toneLabel; }
  public void setToneLabel(String v) { this.toneLabel = v; }
  public String getCtaId() { return ctaId; }
  public void setCtaId(String v) { this.ctaId = v; }
  public String getCtaLabel() { return ctaLabel; }
  public void setCtaLabel(String v) { this.ctaLabel = v; }
  public String getGoal() { return goal; }
  public void setGoal(String v) { this.goal = v; }
  public String getTarget() { return target; }
  public void setTarget(String v) { this.target = v; }
  public String getGradient() { return gradient; }
  public void setGradient(String v) { this.gradient = v; }
  public String getImage() { return image; }
  public void setImage(String v) { this.image = v; }
  public String getTag() { return tag; }
  public void setTag(String v) { this.tag = v; }
}
