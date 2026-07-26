package ai.adflow.api.store.brand;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** TS: LeadMetric = { kind; value: number | null; source; reason? }. */
@Embeddable
public class LeadMetric {

  /**
   * "cpc-max"·"ctr-min" 은 하이픈이 있어 자바 enum 상수명이 될 수 없다. String 으로 두고
   * 허용값은 스키마에만 적는다 — 생성 TS 타입이 유니온이 되도록.
   */
  @Schema(allowableValues = {"cpc-max", "ctr-min"})
  private String kind;

  /**
   * TS 에서 number | null 이다 — optional 이 아니라 "null 을 명시하는" 필드다.
   * 전역 non_null 정책의 예외로 두지 않으면 키가 사라져 undefined 가 된다.
   */
  // VALUE 는 H2 예약어라 컬럼명을 바꾼다(LibraryItem.primary 와 같은 부류).
  // Jackson 은 자바 프로퍼티명을 쓰므로 와이어는 그대로 "value" 다.
  @JsonInclude(JsonInclude.Include.ALWAYS)
  @Column(name = "lead_value")
  private Double value;

  @Schema(allowableValues = {"derived", "custom"})
  private String source;

  @Column(length = 1000)
  private String reason;

  public String getKind() { return kind; }
  public void setKind(String v) { this.kind = v; }
  public Double getValue() { return value; }
  public void setValue(Double v) { this.value = v; }
  public String getSource() { return source; }
  public void setSource(String v) { this.source = v; }
  public String getReason() { return reason; }
  public void setReason(String v) { this.reason = v; }
}
