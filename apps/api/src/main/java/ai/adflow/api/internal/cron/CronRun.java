package ai.adflow.api.internal.cron;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;

/**
 * ADR-042 관측성 1겹 — 폴러 자기기록. cron 1회 실행 = 1행(집계 only).
 *
 * <p>소유자가 없다. cron 은 세션 없이 돈다 — 인가는 JWT 가 아니라 내부 시크릿이다.
 *
 * <p>TS CronRun 의 필드 이름이 snake_case 다(Supabase 행을 그대로 읽던 흔적). health 라우트가 그
 * 이름으로 읽으므로 자바 필드는 camelCase 로 두고 @JsonProperty 로 와이어 이름만 맞춘다.
 */
@Entity
@Table(name = "cron_runs")
public class CronRun {

  /** 원래 PK 가 없는 집계 테이블이다. JPA 가 요구해서 넣고 와이어에서는 감춘다. */
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @JsonIgnore
  private Long id;

  private String job;

  private Boolean ok;

  private Integer scanned = 0;

  private Integer settled = 0;

  private Integer advanced = 0;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "cron_run_errors", joinColumns = @JoinColumn(name = "cron_run_id"))
  @Column(name = "message", length = 2000)
  @OrderColumn(name = "position")
  private List<String> errors = new ArrayList<>();

  @Column(name = "started_at")
  private String startedAt;

  @Column(name = "finished_at")
  private String finishedAt;

  public Long getId() { return id; }
  public void setId(Long v) { this.id = v; }
  public String getJob() { return job; }
  public void setJob(String v) { this.job = v; }
  public Boolean getOk() { return ok; }
  public void setOk(Boolean v) { this.ok = v; }

  public Integer getScanned() { return scanned; }
  public void setScanned(Integer v) { this.scanned = v == null ? 0 : v; }
  public Integer getSettled() { return settled; }
  public void setSettled(Integer v) { this.settled = v == null ? 0 : v; }
  public Integer getAdvanced() { return advanced; }
  public void setAdvanced(Integer v) { this.advanced = v == null ? 0 : v; }

  public List<String> getErrors() { return errors; }
  public void setErrors(List<String> v) { this.errors = v == null ? new ArrayList<>() : v; }

  /** errors 길이의 사본. 화면이 개수만 볼 때 목록을 안 훑게 하려고 저장 시점에 굳힌다. */
  @JsonProperty("error_count")
  public int getErrorCount() { return errors == null ? 0 : errors.size(); }

  @JsonProperty("started_at")
  public String getStartedAt() { return startedAt; }

  @JsonProperty("started_at")
  public void setStartedAt(String v) { this.startedAt = v; }

  @JsonProperty("finished_at")
  public String getFinishedAt() { return finishedAt; }

  @JsonProperty("finished_at")
  public void setFinishedAt(String v) { this.finishedAt = v; }
}
