package ai.adflow.api.store.brand;

import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import io.swagger.v3.oas.annotations.media.Schema;

/** TS: LagTarget = { metric: GoalMetric; target: number }. deprecated AccountGoal 도 같은 형태다. */
@Embeddable
public class LagTarget {

  @Enumerated(EnumType.STRING)
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private GoalMetric metric;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private Double target;

  public GoalMetric getMetric() { return metric; }
  public void setMetric(GoalMetric v) { this.metric = v; }
  public Double getTarget() { return target; }
  public void setTarget(Double v) { this.target = v; }
}
