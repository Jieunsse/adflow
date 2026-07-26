package ai.adflow.api.store.persona;

import ai.adflow.api.store.OwnerScoped;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.List;

/**
 * TS: apps/web/src/features/brand-profile/model/usePersonasStorage.ts 의 PersonaEntry.
 *
 * 배열 셋은 전부 optional 이라 null 을 빈 리스트로 바꾸지 않는다 — "타겟팅 미지정"과
 * "빈 타겟팅"이 화면에서 다르게 읽힌다.
 */
@Entity
@Table(name = "personas")
public class Persona extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "brand_profile_id")
  private String brandProfileId;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String name;

  @Column(name = "age_min")
  private Integer ageMin;

  @Column(name = "age_max")
  private Integer ageMax;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "persona_genders", joinColumns = @JoinColumn(name = "persona_id"))
  @Column(name = "gender")
  @OrderColumn(name = "position")
  private List<Integer> genders;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "persona_locations", joinColumns = @JoinColumn(name = "persona_id"))
  @Column(name = "location")
  @OrderColumn(name = "position")
  private List<String> location;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "persona_interests", joinColumns = @JoinColumn(name = "persona_id"))
  @Column(name = "interest")
  @OrderColumn(name = "position")
  private List<String> interests;

  @Column(name = "customer_description", length = 2000)
  private String customerDescription;

  public String getBrandProfileId() { return brandProfileId; }
  public void setBrandProfileId(String v) { this.brandProfileId = v; }
  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public Integer getAgeMin() { return ageMin; }
  public void setAgeMin(Integer v) { this.ageMin = v; }
  public Integer getAgeMax() { return ageMax; }
  public void setAgeMax(Integer v) { this.ageMax = v; }
  // Hibernate 는 로드 시 @ElementCollection 의 null 을 빈 컬렉션으로 바꾼다. 그대로 두면
  // 전역 non_null 정책을 통과해 [] 가 나가고, TS 의 optional(키 부재)과 어긋난다.
  // 이 필드들은 "미지정"과 "빈 목록"이 같은 뜻이라 비었으면 null 로 접는다.
  public List<Integer> getGenders() { return genders == null || genders.isEmpty() ? null : genders; }
  public void setGenders(List<Integer> v) { this.genders = v; }
  public List<String> getLocation() { return location == null || location.isEmpty() ? null : location; }
  public void setLocation(List<String> v) { this.location = v; }
  public List<String> getInterests() { return interests == null || interests.isEmpty() ? null : interests; }
  public void setInterests(List<String> v) { this.interests = v; }
  public String getCustomerDescription() { return customerDescription; }
  public void setCustomerDescription(String v) { this.customerDescription = v; }
}
