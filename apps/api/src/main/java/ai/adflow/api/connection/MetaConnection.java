package ai.adflow.api.connection;

import ai.adflow.api.security.Role;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Owner Key(= NextAuth 로그인 email) 당 Meta 연결 1건.
 *
 * <p>액세스 토큰 2종은 컬럼 암호화한다 — 60일 장기 토큰이 평문으로 DB 에 앉아 있으면 안 된다.
 */
@Entity
@Table(name = "meta_connections")
public class MetaConnection {

  @Id
  @Column(name = "owner_key")
  private String ownerKey;

  private String email;

  @Enumerated(EnumType.STRING)
  private Role role;

  @Convert(converter = EncryptedStringConverter.class)
  @Column(name = "access_token", length = 2048)
  private String accessToken;

  @Convert(converter = EncryptedStringConverter.class)
  @Column(name = "ig_access_token", length = 2048)
  private String igAccessToken;

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

  @Column(name = "updated_at")
  private Instant updatedAt;

  public String getOwnerKey() {
    return ownerKey;
  }

  public void setOwnerKey(String v) {
    this.ownerKey = v;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String v) {
    this.email = v;
  }

  public Role getRole() {
    return role;
  }

  public void setRole(Role v) {
    this.role = v;
  }

  public String getAccessToken() {
    return accessToken;
  }

  public void setAccessToken(String v) {
    this.accessToken = v;
  }

  public String getIgAccessToken() {
    return igAccessToken;
  }

  public void setIgAccessToken(String v) {
    this.igAccessToken = v;
  }

  public String getAdAccountId() {
    return adAccountId;
  }

  public void setAdAccountId(String v) {
    this.adAccountId = v;
  }

  public String getAdAccountName() {
    return adAccountName;
  }

  public void setAdAccountName(String v) {
    this.adAccountName = v;
  }

  public String getPageId() {
    return pageId;
  }

  public void setPageId(String v) {
    this.pageId = v;
  }

  public String getPageName() {
    return pageName;
  }

  public void setPageName(String v) {
    this.pageName = v;
  }

  public String getPixelId() {
    return pixelId;
  }

  public void setPixelId(String v) {
    this.pixelId = v;
  }

  public String getPixelName() {
    return pixelName;
  }

  public void setPixelName(String v) {
    this.pixelName = v;
  }

  public String getIgUserId() {
    return igUserId;
  }

  public void setIgUserId(String v) {
    this.igUserId = v;
  }

  public String getIgUsername() {
    return igUsername;
  }

  public void setIgUsername(String v) {
    this.igUsername = v;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(Instant v) {
    this.updatedAt = v;
  }
}
