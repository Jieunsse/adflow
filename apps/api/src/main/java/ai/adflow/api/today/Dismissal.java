package ai.adflow.api.today;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** "나중에"를 누른 오늘의 결정. 같은 근거(key)는 until 까지 다시 보여 주지 않는다 (정책서 15.1). */
@Entity
@Table(name = "today_dismissals")
public class Dismissal {

  /** "{이메일}|{카드 key}" */
  @Id private String id;

  @Column(nullable = false)
  private Instant until;

  protected Dismissal() {}

  public Dismissal(String id, Instant until) {
    this.id = id;
    this.until = until;
  }

  public Instant getUntil() { return until; }
}
