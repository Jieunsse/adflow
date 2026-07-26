package ai.adflow.api.tournament;

import ai.adflow.api.tournament.engine.AdKpi;
import ai.adflow.api.tournament.engine.Hypothesis;
import ai.adflow.api.tournament.engine.RoundVerdict;
import ai.adflow.api.tournament.engine.SettleResult;
import ai.adflow.api.tournament.engine.TourEngine;
import ai.adflow.api.tournament.engine.TourHypothesis;
import ai.adflow.api.tournament.engine.TourState;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * 라운드 결산 — 단계 5 의 종착점. TS server-runner 의 pollAndSettle 을 Java 가 인수한다.
 *
 * <p>Java 가 소유하는 판정: 가설 verdict 확정(ADR-044) · 챔피언 승격 · 수렴(ADR-061) · 봉투 소진
 * (ADR-054) · 라운드당 예산 차감. 단계 6 부터 Meta 조회도 Java 다(TournamentKpiSource).
 *
 * <p>ad study 가 유의성을 못 냈으면 결산하지 않고 insufficient 로 돌려보낸다 — 다음 폴이 재시도한다.
 */
@Service
public class TournamentSettleService {

  /** TS ServerSettleResult 와 같은 모양. status 외 필드는 settled 일 때만 실린다. */
  public record Outcome(
      String status, TourRound round, Boolean winnerIsB, String badge, Boolean completed) {

    static final Outcome NO_ACTIVE = new Outcome("no-active", null, null, null, null);
    static final Outcome INSUFFICIENT = new Outcome("insufficient", null, null, null, null);
  }

  private final TournamentRepository repository;
  private final TournamentKpiSource kpiSource;

  public TournamentSettleService(TournamentRepository repository, TournamentKpiSource kpiSource) {
    this.repository = repository;
    this.kpiSource = kpiSource;
  }

  @Transactional
  public Outcome settle(String id) {
    Tournament t = repository.findById(id).orElse(null);
    if (t == null) return Outcome.NO_ACTIVE;

    TourRound r =
        t.getRounds().stream().filter(x -> "running".equals(x.getStatus())).findFirst().orElse(null);
    if (r == null) return Outcome.NO_ACTIVE;

    TournamentKpiSource.Reading reading = kpiSource.read(t, r);
    if (reading == null || reading.verdict() == null) return Outcome.INSUFFICIENT;

    RoundVerdict verdict = reading.verdict();
    String rawWinner = reading.winner() == null ? SettleResult.CHAMPION : reading.winner();

    r.setVerdict(toEntity(verdict));
    r.setRawWinner(rawWinner);
    r.setAdKpis(toEntity(reading.kpis()));
    r.setStatus("settled");
    if (r.getHypothesis() != null) {
      Hypothesis resolved =
          TourHypothesis.resolveHypothesis(
              toEngine(r.getHypothesis()), verdict, rawWinner, Instant.now().toString());
      applyResolved(r.getHypothesis(), resolved);
    }

    boolean winnerIsB = "B".equals(rawWinner);
    t.setChampion(winnerIsB ? r.getChallenger() : r.getChampion());
    t.setChampionCtr(winnerIsB ? verdict.ctrB() : verdict.ctrA());
    t.setAxisCursor(nz(t.getAxisCursor()) + 1);
    // 실 게재 라운드당 최소 기간만큼 봉투 차감(보수적) — TS 와 같은 계산이다.
    t.setSpentBudget(nz(t.getSpentBudget()) + nz(t.getDailyBudget()) * TourEngine.MIN_ROUND_DAYS);

    // ADR-061 — 챔피언 N회 연속 방어 = 수렴. 방금 결산한 라운드가 포함된 상태로 본다.
    if (TourEngine.hasConverged(stateOf(t))) {
      t.setStatus("completed");
      t.setCompletionReason("converged");
    }

    // ADR-054 — 봉투 소진은 자동 완료가 아니라 winner-handling 으로 사람에게 넘긴다.
    boolean completed = "completed".equals(t.getStatus()) || TourEngine.isEnvelopeExhausted(stateOf(t));
    repository.save(t);

    return new Outcome(
        "settled",
        r,
        winnerIsB,
        RoundVerdict.WINNER.equals(verdict.state()) ? "winner" : "inconclusive",
        completed);
  }

  /* ─── 엔티티 ↔ 엔진 뷰 ─────────────────────────────────────── */

  /** 엔진은 JPA 를 모른다(TourState javadoc) — 상태 판정에 쓰는 6필드만 옮긴다. */
  private static TourState stateOf(Tournament t) {
    List<TourState.Round> rounds = new ArrayList<>();
    for (TourRound r : t.getRounds()) {
      rounds.add(
          new TourState.Round(
              r.getStatus(),
              r.getRawWinner(),
              r.getVerdict() == null ? null : r.getVerdict().getState(),
              nz(r.getFastForwardDays())));
    }

    Tournament.Envelope e = t.getEnvelope();
    TourState.Envelope env = null;
    if (e != null) {
      Tournament.AutoRefill ar = e.getAutoRefill();
      TourState.AutoRefill refill =
          ar == null || ar.getAddBudget() == null || ar.getHardCap() == null
              ? null
              : new TourState.AutoRefill(ar.getAddBudget(), ar.getHardCap());
      env =
          new TourState.Envelope(
              e.getTotalBudget(), e.getTargetDate(), refill, e.getStopOnDefendStreak());
    }

    return new TourState(
        Boolean.TRUE.equals(t.getChampionConfirmed()),
        t.getStatus(),
        nz(t.getSpentBudget()),
        t.getCreatedAt(),
        env,
        rounds);
  }

  private static Hypothesis toEngine(TourRound.HypothesisData h) {
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

  /** resolveHypothesis 가 바꾸는 것은 뒤 4필드뿐이다 — 나머지를 되쓰지 않고 제자리에서 갱신한다. */
  private static void applyResolved(TourRound.HypothesisData target, Hypothesis resolved) {
    target.setStatus(resolved.status());
    target.setVerdict(resolved.verdict());
    target.setEffectSize(resolved.effectSize());
    target.setResolvedAt(resolved.resolvedAt());
  }

  private static TourRound.Verdict toEntity(RoundVerdict v) {
    TourRound.Verdict out = new TourRound.Verdict();
    out.setState(v.state());
    out.setCtrA(v.ctrA());
    out.setCtrB(v.ctrB());
    out.setConfidence(v.confidence());
    return out;
  }

  private static List<TourRound.Kpi> toEntity(List<AdKpi> kpis) {
    if (kpis == null) return null;
    List<TourRound.Kpi> out = new ArrayList<>();
    for (AdKpi k : kpis) {
      TourRound.Kpi kpi = new TourRound.Kpi();
      kpi.setImpressions(k.impressions());
      kpi.setClicks(k.clicks());
      kpi.setCtr(k.ctr());
      kpi.setSpend(k.spend());
      out.add(kpi);
    }
    return out;
  }

  private static int nz(Integer v) {
    return v == null ? 0 : v;
  }

  private static double nz(Double v) {
    return v == null ? 0 : v;
  }
}
