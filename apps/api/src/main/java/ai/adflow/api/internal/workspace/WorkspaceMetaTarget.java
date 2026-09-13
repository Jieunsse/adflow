package ai.adflow.api.internal.workspace;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 전역 workspace 연결 대상. 사용자별 Meta 연결과 분리한다. */
@Entity
@Table(name = "workspace_meta_target")
public class WorkspaceMetaTarget {

  public static final String GLOBAL_ID = "global";

  @Id
  private String id = GLOBAL_ID;

  @Column(name = "ad_account_id")
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

  @jakarta.persistence.Version
  private long version;

  public String getId() { return id; }
  public void setId(String v) { this.id = v; }
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
}
