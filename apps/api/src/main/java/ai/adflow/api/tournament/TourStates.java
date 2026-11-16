package ai.adflow.api.tournament;

import ai.adflow.api.tournament.engine.Hypothesis;
import ai.adflow.api.tournament.engine.TourState;
import java.util.ArrayList;
import java.util.List;

/**
 * 영속 엔티티 → 엔진 뷰. 엔진은 JPA 를 모른다(TourState javadoc) — 그 경계를 여기 한 곳에 모은다.
 *
 * <p>결산(TournamentSettleService)과 자동 진행(TournamentAdvanceService)이 같은 변환을 쓴다. 둘이
 * 각자 매핑하면 한쪽만 필드를 추가했을 때 상태 판정이 조용히 갈린다.
 */
final class TourStates {

  private TourStates() {}

  static TourState of(Tournament t) {
    List<TourState.Round> rounds = new ArrayList<>();
    for (TourRound r : t.getRounds()) {
      rounds.add(
          new TourState.Round(
              r.getStatus(),
              r.getRawWinner(),
              r.getVerdict() == null ? null : r.getVerdict().getState(),
              r.getFastForwardDays() == null ? 0 : r.getFastForwardDays()));
    }

    Tournament.Envelope e = t.getEnvelope();
    TourState.Envelope env = null;
    if (e != null) {
      Tournament.AutoRefill ar = e.getAutoRefill();
      TourState.AutoRefill refill =
          ar == null || ar.getAddBudget() == null || ar.getHardCap() == null
              ? null
              : new TourState.AutoRefill(ar.getAddBudget(), ar.getHardCap());
      env = new TourState.Envelope(e.getTotalBudget(), e.getTargetDate(), refill, e.getStopOnDefendStreak());
    }

    return new TourState(
        Boolean.TRUE.equals(t.getChampionConfirmed()),
        t.getStatus(),
        t.getSpentBudget() == null ? 0 : t.getSpentBudget(),
        t.getCreatedAt(),
        env,
        rounds);
  }

  static Hypothesis hypothesisOf(TourRound.HypothesisData h) {
    TourRound.ContextTags c = h.getContextTags();
    return new Hypothesis(
        h.getId(),
        h.getLever(),
        h.getStatement(),
        h.getPredictedMetric(),
        h.getPredictedDirection(),
        h.getRationale(),
        h.getRationaleSource(),
        c == null ? null : new Hypothesis.ContextTags(c.getProductId(), c.getPersonaId(), c.getObjective()),
        h.getStatus(),
        h.getVerdict(),
        h.getEffectSize(),
        h.getResolvedAt());
  }
}
