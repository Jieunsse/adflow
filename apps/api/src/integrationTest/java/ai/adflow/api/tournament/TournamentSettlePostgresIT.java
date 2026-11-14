package ai.adflow.api.tournament;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import ai.adflow.api.tournament.engine.AdKpi;
import ai.adflow.api.tournament.engine.RoundVerdict;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 결산이 실제 Postgres 위에서 애그리거트를 고치는지 실측한다.
 *
 * <p>H2 가 못 잡는 것 — 이미 영속된 라운드에 @ElementCollection(adKpis)를 새로 달고 @OrderColumn 이
 * 붙은 자식 목록을 갱신할 때 행이 누적되거나 순서가 어긋나는지.
 */
@Import(TournamentSettlePostgresIT.Stubs.class)
class TournamentSettlePostgresIT extends IntegrationTestBase {

  /** ad study 응답 스텁 — Meta 를 실제로 부르지 않는다. */
  static class StubKpiSource extends TournamentKpiSource {
    static Reading next;

    StubKpiSource() {
      super(null);
    }

    @Override
    public Reading read(Tournament t, TourRound round) {
      return next;
    }
  }

  @TestConfiguration
  static class Stubs {
    @Bean
    @Primary
    TournamentKpiSource stubKpiSource() {
      return new StubKpiSource();
    }
  }

  @Autowired private TournamentRepository repository;
  @Autowired private TournamentSettleService settleService;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private ai.adflow.api.learning.LearningRepository learnings;

  private static Tournament.Variant variant(String headline, String primaryText) {
    Tournament.Variant v = new Tournament.Variant();
    v.setHeadline(headline);
    v.setPrimaryText(primaryText);
    return v;
  }

  private static TourRound.HypothesisData hypothesis() {
    TourRound.ContextTags tags = new TourRound.ContextTags();
    tags.setProductId("prod_1");
    tags.setObjective("traffic");

    TourRound.HypothesisData h = new TourRound.HypothesisData();
    h.setId("hyp_settle");
    h.setLever("benefit");
    h.setStatement("혜택을 먼저 말하면 CTR이 오른다");
    h.setPredictedMetric("CTR");
    h.setPredictedDirection("up");
    h.setRationale("근거");
    h.setRationaleSource("ledger");
    h.setContextTags(tags);
    h.setStatus("testing");
    return h;
  }

  private void save(String id) {
    TourRound r1 = new TourRound();
    r1.setIndex(1);
    r1.setAxis("headline");
    r1.setCampaignId("c1");
    r1.setChampion(variant("A", "AP"));
    r1.setChallenger(variant("B", "BP"));
    r1.setFastForwardDays(0);
    r1.setStatus("running");
    r1.setStudyId("study_1");
    r1.setLaunchedAt(Instant.now().minus(java.time.Duration.ofDays(5)).toString()); // 판정 최소 4일
    r1.setHypothesis(hypothesis());

    Tournament t = new Tournament();
    t.setId(id);
    t.setOwnerKey("pg@example.com");
    t.setUpdatedAt(Instant.now());
    t.setBrandProfileId("bp_pg");
    t.setProductId("prod_1");
    t.setProductName("제품");
    t.setTone("warm");
    t.setObjective("traffic");
    t.setDailyBudget(30000.0);
    t.setChampion(variant("A", "AP"));
    t.setChampionCtr(1.8);
    t.setChampionConfirmed(true);
    t.setAxisCursor(0);
    t.setSpentBudget(0.0);
    t.setStatus("running");
    t.setCreatedAt("2026-07-01T00:00:00Z");
    t.setRounds(new ArrayList<>(List.of(r1)));

    TournamentDelivery d = new TournamentDelivery();
    d.setAccessToken("EAAG_secret_long_lived");
    d.setAdAccountId("act_1");
    d.setPageId("page_1");
    d.setOwnerEmail("pg@example.com");
    t.setDelivery(d);

    repository.saveAndFlush(t);
  }

  @Test
  void 결산이_라운드와_챔피언을_고치고_자식이_누적되지_않는다() {
    save("tourn_pg_settle");
    StubKpiSource.next =
        new TournamentKpiSource.Reading(
            List.of(new AdKpi(15000, 270, 1.8, 91911), new AdKpi(15000, 360, 2.4, 91911)),
            new RoundVerdict("winner", 1.8, 2.4, 0.97),
            "B");

    var outcome = settleService.settle("tourn_pg_settle");
    assertThat(outcome.status()).isEqualTo("settled");
    assertThat(outcome.winnerIsB()).isTrue();

    Tournament found = repository.findById("tourn_pg_settle").orElseThrow();
    assertThat(found.getChampion().getHeadline()).isEqualTo("B");
    assertThat(found.getChampionCtr()).isEqualTo(2.4);
    assertThat(found.getSpentBudget()).isEqualTo(120000.0); // MIN_ROUND_DAYS(4) × 30000
    assertThat(found.getRounds()).hasSize(1);
    assertThat(found.getRounds().get(0).getStatus()).isEqualTo("settled");
    assertThat(found.getRounds().get(0).getVerdict().getConfidence()).isEqualTo(0.97);
    assertThat(found.getRounds().get(0).getHypothesis().getVerdict()).isEqualTo("confirmed");
    // 판정이 끝나면 배운 것 초안이 생긴다 (정책서 14.1).
    var learning = learnings.findById("tourn_pg_settle_r1").orElseThrow();
    assertThat(learning.getStatus()).isEqualTo("draft");
    assertThat(learning.getResult()).isEqualTo("challenger_won");

    // @OrderColumn 이 붙은 KPI 두 행이 순서대로 정확히 두 개여야 한다.
    Integer kpiRows =
        jdbc.queryForObject(
            "select count(*) from tour_round_ad_kpis k join tour_rounds r on k.round_id = r.id"
                + " where r.tournament_id = 'tourn_pg_settle'",
            Integer.class);
    assertThat(kpiRows).isEqualTo(2);
    assertThat(found.getRounds().get(0).getAdKpis())
        .extracting(TourRound.Kpi::getClicks)
        .containsExactly(270, 360);
  }

  @Test
  void 기간이_끝났는데_노출이_모자라면_판정_불가로_끝내고_챔피언과_가설은_그대로다() {
    save("tourn_pg_short");
    StubKpiSource.next =
        new TournamentKpiSource.Reading(
            List.of(new AdKpi(380, 9, 2.4, 3000), new AdKpi(1200, 30, 2.5, 3000)),
            new RoundVerdict("winner", 2.4, 2.5, 0.95),
            "B");

    var outcome = settleService.settle("tourn_pg_short");
    assertThat(outcome.status()).isEqualTo("unjudgeable");

    Tournament found = repository.findById("tourn_pg_short").orElseThrow();
    TourRound r = found.getRounds().get(0);
    assertThat(r.getStatus()).isEqualTo("unjudgeable");
    assertThat(r.getImpressionShortfall()).isEqualTo(620);
    assertThat(found.getChampion().getHeadline()).isEqualTo("A");
    assertThat(found.getSpentBudget()).isZero();
    assertThat(r.getHypothesis().getStatus()).isEqualTo("testing");
  }

  @Test
  void 동시_수정은_낙관적_락이_잡는다() {
    // 설계 §6 — 폴러와 화면이 같은 토너먼트를 동시에 고칠 수 있다. 버전이 없으면 나중에 저장한 쪽이
    // 앞선 변경을 조용히 덮는다.
    save("tourn_pg_lock");

    Tournament a = repository.findById("tourn_pg_lock").orElseThrow();
    Tournament b = repository.findById("tourn_pg_lock").orElseThrow();

    a.setChampionCtr(9.9);
    repository.saveAndFlush(a);

    b.setChampionCtr(1.1);
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> repository.saveAndFlush(b))
        .isInstanceOf(org.springframework.orm.ObjectOptimisticLockingFailureException.class);

    assertThat(repository.findById("tourn_pg_lock").orElseThrow().getChampionCtr()).isEqualTo(9.9);
  }

  @Test
  void 스터디_미확정이면_아무것도_고치지_않는다() {
    save("tourn_pg_pending");
    // 노출은 채웠지만 Meta 가 아직 결과를 주지 않았다 — 기간이 지나도 기다린다 (정책서 13.1).
    StubKpiSource.next =
        new TournamentKpiSource.Reading(
            List.of(new AdKpi(15000, 270, 1.8, 91911), new AdKpi(15000, 360, 2.4, 91911)), null, null);

    assertThat(settleService.settle("tourn_pg_pending").status()).isEqualTo("insufficient");

    Tournament found = repository.findById("tourn_pg_pending").orElseThrow();
    assertThat(found.getRounds().get(0).getStatus()).isEqualTo("running");
    assertThat(found.getRounds().get(0).getVerdict()).isNull();
    assertThat(found.getSpentBudget()).isEqualTo(0.0);
  }
}
