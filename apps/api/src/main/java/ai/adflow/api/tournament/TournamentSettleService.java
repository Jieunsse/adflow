package ai.adflow.api.tournament;

import ai.adflow.api.learning.Learnings;
import ai.adflow.api.tournament.engine.AdKpi;
import ai.adflow.api.tournament.engine.Hypothesis;
import ai.adflow.api.tournament.engine.RoundVerdict;
import ai.adflow.api.tournament.engine.SettleResult;
import ai.adflow.api.tournament.engine.TourEngine;
import ai.adflow.api.tournament.engine.TourHypothesis;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.Duration;
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
 * <p>판정 조건 (정책서 13.1): 게재 4일 이상 · 소재별 노출 1,000회 이상 · Meta 결과가 나옴. 조건을 못 채우면
 * insufficient 로 돌려보내 다음 폴이 재시도한다. 실험 기간이 끝났는데 노출이 모자라면 판정 불가로 끝낸다.
 */
@Service
public class TournamentSettleService {

  /** TS ServerSettleResult 와 같은 모양. status 외 필드는 settled 일 때만 실린다. */
  public record Outcome(
      String status, TourRound round, Boolean winnerIsB, String badge, Boolean completed) {

    static final Outcome NO_ACTIVE = new Outcome("no-active", null, null, null, null);
    static final Outcome INSUFFICIENT = new Outcome("insufficient", null, null, null, null);
  }

  /** 소재별 최소 노출 수. 정책서 13.1 의 임시 값이다 (소액 계정 2주 실험 뒤 확정). */
  public static final int MIN_IMPRESSIONS_PER_AD = 1000;

  enum Gate { WAIT, UNJUDGEABLE, JUDGE }

  /**
   * 판정해도 되는지. 노출이 모자란 채로 기간이 끝나면 판정 불가다. 노출은 채웠는데 Meta 결과가 아직이면
   * 기간이 지나도 기다린다 (정책서 13.1: 다음 수집 때 다시 확인).
   */
  static Gate gate(double elapsedDays, int roundDays, int shortfall, boolean metaResult) {
    if (shortfall > 0) return elapsedDays >= roundDays ? Gate.UNJUDGEABLE : Gate.WAIT;
    if (elapsedDays < TourEngine.MIN_ROUND_DAYS || !metaResult) return Gate.WAIT;
    return Gate.JUDGE;
  }

  private final TournamentRepository repository;
  private final TournamentKpiSource kpiSource;
  private final Clock clock;
  private final Learnings learnings;

  public TournamentSettleService(
      TournamentRepository repository,
      TournamentKpiSource kpiSource,
      Clock clock,
      Learnings learnings) {
    this.repository = repository;
    this.kpiSource = kpiSource;
    this.clock = clock;
    this.learnings = learnings;
  }

  @Transactional
  public Outcome settle(String id) {
    Tournament t = repository.findById(id).orElse(null);
    if (t == null) return Outcome.NO_ACTIVE;

    TourRound r =
        t.getRounds().stream().filter(x -> "running".equals(x.getStatus())).findFirst().orElse(null);
    if (r == null) return Outcome.NO_ACTIVE;

    TournamentKpiSource.Reading reading = kpiSource.read(t, r);
    if (reading == null) return Outcome.INSUFFICIENT;

    int shortfall = shortfall(reading.kpis());
    int roundDays =
        t.getDelivery() == null || t.getDelivery().getRoundDays() == null
            ? TourEngine.MIN_ROUND_DAYS
            : Math.max(TourEngine.MIN_ROUND_DAYS, t.getDelivery().getRoundDays());
    Gate gate = gate(elapsedDays(r), roundDays, shortfall, reading.verdict() != null);
    r.setImpressionShortfall(shortfall);
    if (reading.kpis() != null) r.setSpendToDate(reading.kpis().stream().mapToDouble(AdKpi::spend).sum());
    if (gate == Gate.WAIT) {
      repository.save(t);
      return Outcome.INSUFFICIENT;
    }
    if (gate == Gate.UNJUDGEABLE) {
      // 챔피언·가설·예산은 그대로 둔다. 판정하지 못한 실험을 "차이 없음"으로 기록하면 틀린 배운 것이 남는다.
      r.setAdKpis(toEntity(reading.kpis()));
      r.setStatus("unjudgeable");
      repository.save(t);
      learnings.record(t, r, Learnings.UNJUDGEABLE);
      return new Outcome("unjudgeable", r, null, null, false);
    }
    RoundVerdict verdict = reading.verdict();

    String rawWinner = reading.winner() == null ? SettleResult.CHAMPION : reading.winner();

    r.setVerdict(toEntity(verdict));
    r.setRawWinner(rawWinner);
    r.setAdKpis(toEntity(reading.kpis()));
    r.setStatus("settled");
    if (r.getHypothesis() != null) {
      Hypothesis resolved =
          TourHypothesis.resolveHypothesis(
              TourStates.hypothesisOf(r.getHypothesis()), verdict, rawWinner, Instant.now().toString());
      applyResolved(r.getHypothesis(), resolved);
    }

    boolean winnerIsB = "B".equals(rawWinner);
    learnings.record(
        t,
        r,
        !RoundVerdict.WINNER.equals(verdict.state())
            ? Learnings.NO_DIFFERENCE
            : winnerIsB ? Learnings.CHALLENGER_WON : Learnings.CHAMPION_WON);
    t.setChampion(winnerIsB ? r.getChallenger() : r.getChampion());
    t.setChampionCtr(winnerIsB ? verdict.ctrB() : verdict.ctrA());
    t.setAxisCursor(nz(t.getAxisCursor()) + 1);
    // 실 게재 라운드당 최소 기간만큼 봉투 차감(보수적) — TS 와 같은 계산이다.
    t.setSpentBudget(nz(t.getSpentBudget()) + nz(t.getDailyBudget()) * TourEngine.MIN_ROUND_DAYS);

    // ADR-061 — 챔피언 N회 연속 방어 = 수렴. 방금 결산한 라운드가 포함된 상태로 본다.
    if (TourEngine.hasConverged(TourStates.of(t))) {
      t.setStatus("completed");
      t.setCompletionReason("converged");
    }

    // ADR-054 — 봉투 소진은 자동 완료가 아니라 winner-handling 으로 사람에게 넘긴다.
    boolean completed = "completed".equals(t.getStatus()) || TourEngine.isEnvelopeExhausted(TourStates.of(t));
    repository.save(t);

    return new Outcome(
        "settled",
        r,
        winnerIsB,
        RoundVerdict.WINNER.equals(verdict.state()) ? "winner" : "inconclusive",
        completed);
  }

  /** 두 소재 중 노출이 적은 쪽 기준으로 모자란 수. 성과를 아직 못 가져왔으면 전부 모자란다. */
  private static int shortfall(List<AdKpi> kpis) {
    if (kpis == null || kpis.size() < 2) return MIN_IMPRESSIONS_PER_AD;
    int least = Math.min(kpis.get(0).impressions(), kpis.get(1).impressions());
    return Math.max(0, MIN_IMPRESSIONS_PER_AD - least);
  }

  /** 게재 시각을 모르면 0일로 본다 — 기간 조건을 채웠다고 가정하지 않는다. */
  private double elapsedDays(TourRound r) {
    if (r.getLaunchedAt() == null) return 0;
    return Duration.between(Instant.parse(r.getLaunchedAt()), clock.instant()).toHours() / 24.0;
  }

  /* ─── 엔티티 ↔ 엔진 뷰 ─────────────────────────────────────── */

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
