package ai.adflow.api.tournament;

import ai.adflow.api.connection.EncryptedStringConverter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.List;

/**
 * 실 게재 자격증명 + 게재 스펙 (ADR-038 결정 3). TS: TournamentDelivery.
 *
 * <p>cron 폴러가 세션 없이 라운드를 게재·폴링해야 해서 유저 장기 토큰과 계정·페이지·타겟을 토너먼트에
 * 박아둔다. 둘러보기는 이 봉투가 없다(시뮬 경로).
 *
 * <p><b>accessToken 은 암호화 컬럼이다.</b> Supabase 시절엔 60일 장기 토큰이 data jsonb 안에 평문으로
 * 앉아 있었다 — 정규화하면서 MetaConnection 과 같은 처방을 건다.
 *
 * <p>별도 테이블인 이유: 배열 둘(countries·genders)이 컬렉션 테이블을 요구하고, 토큰 컬럼을 부모에서
 * 떼어놓는 편이 실수로 로그에 흘릴 여지를 줄인다.
 */
@Entity
@Table(name = "tournament_delivery")
public class TournamentDelivery {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @JsonIgnore
  private Long id;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Convert(converter = EncryptedStringConverter.class)
  @Column(name = "access_token", length = 4096)
  private String accessToken;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "ad_account_id")
  private String adAccountId;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "page_id")
  private String pageId;

  /** cron 이 SSE 를 푸시할 대상. */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "owner_email")
  private String ownerEmail;

  @Column(name = "goal_id")
  private String goalId;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "link_url", length = 2048)
  private String linkUrl;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "cta_type")
  private String ctaType;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "tournament_delivery_countries", joinColumns = @JoinColumn(name = "delivery_id"))
  @Column(name = "country")
  @OrderColumn(name = "position")
  private List<String> countries;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "age_min")
  private Integer ageMin;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "age_max")
  private Integer ageMax;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "tournament_delivery_genders", joinColumns = @JoinColumn(name = "delivery_id"))
  @Column(name = "gender")
  @OrderColumn(name = "position")
  private List<Integer> genders;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "round_days")
  private Integer roundDays;

  @Column(name = "image_data_url", length = 100000)
  private String imageDataUrl;

  public String getAccessToken() { return accessToken; }
  public void setAccessToken(String v) { this.accessToken = v; }
  public String getAdAccountId() { return adAccountId; }
  public void setAdAccountId(String v) { this.adAccountId = v; }
  public String getPageId() { return pageId; }
  public void setPageId(String v) { this.pageId = v; }
  public String getOwnerEmail() { return ownerEmail; }
  public void setOwnerEmail(String v) { this.ownerEmail = v; }
  public String getGoalId() { return goalId; }
  public void setGoalId(String v) { this.goalId = v; }
  public String getLinkUrl() { return linkUrl; }
  public void setLinkUrl(String v) { this.linkUrl = v; }
  public String getCtaType() { return ctaType; }
  public void setCtaType(String v) { this.ctaType = v; }

  /** countries 는 required 라 비었어도 배열로 나가야 한다 — genders 만 optional 이다. */
  public List<String> getCountries() { return countries == null ? List.of() : countries; }

  public void setCountries(List<String> v) { this.countries = v; }
  public Integer getAgeMin() { return ageMin; }
  public void setAgeMin(Integer v) { this.ageMin = v; }
  public Integer getAgeMax() { return ageMax; }
  public void setAgeMax(Integer v) { this.ageMax = v; }
  public List<Integer> getGenders() { return genders == null || genders.isEmpty() ? null : genders; }
  public void setGenders(List<Integer> v) { this.genders = v; }
  public Integer getRoundDays() { return roundDays; }
  public void setRoundDays(Integer v) { this.roundDays = v; }
  public String getImageDataUrl() { return imageDataUrl; }
  public void setImageDataUrl(String v) { this.imageDataUrl = v; }
}
