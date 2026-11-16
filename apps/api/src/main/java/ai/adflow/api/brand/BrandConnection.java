package ai.adflow.api.brand;

import ai.adflow.api.store.OwnerScoped;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * 브랜드 하나의 광고 계정·페이지·담당 직원 (기능 10). id 는 브랜드 프로필 id 다 — 지금은 브랜드 프로필이
 * 곧 브랜드다 (기능명세 1.2).
 *
 * <p>브랜드 프로필 행에 넣지 않은 이유: 프로필은 클라이언트가 문서 전체를 지우고 새로 쓴다
 * (StoreController). 같은 행에 두면 프로필을 저장할 때마다 연결이 지워진다.
 */
@Entity
@Table(name = "brand_connections")
public class BrandConnection extends OwnerScoped {

  /** 광고 계정 하나는 브랜드 하나에만 연결한다 (기능명세 10-3). */
  @Column(name = "ad_account_id", unique = true)
  private String adAccountId;

  @Column(name = "ad_account_name")
  private String adAccountName;

  @Column(name = "page_id")
  private String pageId;

  @Column(name = "page_name")
  private String pageName;

  @Column(name = "pixel_id")
  private String pixelId;

  @Column(name = "pixel_name")
  private String pixelName;

  @Column(name = "ig_user_id")
  private String igUserId;

  @Column(name = "ig_username")
  private String igUsername;

  @Column(name = "manager_email")
  private String managerEmail;

  public String getAdAccountId() { return adAccountId; }
  public void setAdAccountId(String v) { this.adAccountId = v; }
  public String getAdAccountName() { return adAccountName; }
  public void setAdAccountName(String v) { this.adAccountName = v; }
  public String getPageId() { return pageId; }
  public void setPageId(String v) { this.pageId = v; }
  public String getPageName() { return pageName; }
  public void setPageName(String v) { this.pageName = v; }
  public String getPixelId() { return pixelId; }
  public void setPixelId(String v) { this.pixelId = v; }
  public String getPixelName() { return pixelName; }
  public void setPixelName(String v) { this.pixelName = v; }
  public String getIgUserId() { return igUserId; }
  public void setIgUserId(String v) { this.igUserId = v; }
  public String getIgUsername() { return igUsername; }
  public void setIgUsername(String v) { this.igUsername = v; }
  public String getManagerEmail() { return managerEmail; }
  public void setManagerEmail(String v) { this.managerEmail = v; }
}
