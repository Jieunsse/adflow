package ai.adflow.api.store.brand;

import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

/** TS: LagTarget = { metric: GoalMetric; target: number }. deprecated AccountGoal 도 같은 형태다. */
@Embeddable
public class LagTarget {

  @Enumerated(EnumType.STRING)
  private GoalMetric metric;

  private Double target;

  public GoalMetric getMetric() { return metric; }
  public void setMetric(GoalMetric v) { this.metric = v; }
  public Double getTarget() { return target; }
  public void setTarget(Double v) { this.target = v; }
}
