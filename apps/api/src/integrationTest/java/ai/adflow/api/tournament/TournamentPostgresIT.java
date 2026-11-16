package ai.adflow.api.tournament;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/** 정규화가 실제로 일어났는지 · 장기 토큰이 평문이 아닌지 · 라운드 순서가 영속되는지 실측한다. */
class TournamentPostgresIT extends IntegrationTestBase {

  @Autowired private TournamentRepository repository;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private TransactionTemplate transactions;

  private static Tournament.Variant variant(String headline, String primaryText) {
    Tournament.Variant v = new Tournament.Variant();
    v.setHeadline(headline);
    v.setPrimaryText(primaryText);
    return v;
  }

  private static TourRound round(int index, String status, String rawWinner) {
    TourRound r = new TourRound();
    r.setIndex(index);
    r.setAxis("headline");
    r.setCampaignId("browse_tourn_pg_r" + index);
    r.setChampion(variant("A" + index, "AP"));
    r.setChallenger(variant("B" + index, "AP"));
    r.setFastForwardDays(7);
    r.setStatus(status);
    r.setRawWinner(rawWinner);
    return r;
  }

  private Tournament save(String id) {
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
    t.setChampion(variant("챔피언", "카피"));
    t.setChampionCtr(1.8);
    t.setAxisCursor(0);
    t.setSpentBudget(0.0);
    t.setStatus("running");
    t.setCreatedAt("2026-07-01T00:00:00Z");
    t.setRounds(List.of(round(1, "settled", "A"), round(2, "settled", "B"), round(3, "running", null)));

    TournamentDelivery d = new TournamentDelivery();
    d.setAccessToken("EAAG_secret_long_lived");
    d.setAdAccountId("act_1");
    d.setPageId("page_1");
    d.setOwnerEmail("pg@example.com");
    d.setLinkUrl("https://shop.example.com");
    d.setCtaType("LEARN_MORE");
    d.setCountries(List.of("KR", "JP"));
    d.setAgeMin(25);
    d.setAgeMax(44);
    d.setGenders(List.of(2));
    d.setRoundDays(7);
    t.setDelivery(d);

    return repository.saveAndFlush(t);
  }

  @Test
  void 애그리거트가_여러_테이블로_펼쳐진다() {
    save("tourn_pg_shape");

    List<String> tables =
        jdbc.queryForList(
            "select table_name from information_schema.tables where table_schema = 'public' order by 1",
            String.class);

    // 설계 §5 의 정규화 — data jsonb 통짜가 아니라 관계형으로 펼쳐져야 한다.
    assertThat(tables)
        .contains(
            "tournaments",
            "tour_rounds",
            "tour_round_ad_kpis",
            "tour_round_ad_ids",
            "tournament_delivery",
            "tournament_delivery_countries");

    List<String> columns =
        jdbc.queryForList(
            "select column_name from information_schema.columns where table_name = 'tournaments' order by 1",
            String.class);
    // 중첩 타입이 컬럼으로 펼쳐졌는지 — 임베더블이 실제로 부모 테이블에 앉는다.
    assertThat(columns)
        .contains(
            "champion_headline",
            "pending_headline",
            "envelope_total_budget",
            "auto_refill_hard_cap",
            "hyp_lever",
            "owner_key");
    // jsonb 통짜 컬럼이 남아 있으면 정규화가 덜 된 것이다.
    assertThat(columns).doesNotContain("data");
  }

  @Test
  void 장기_토큰이_평문으로_저장되지_않는다() {
    save("tourn_pg_token");

    String stored =
        jdbc.queryForObject("select access_token from tournament_delivery limit 1", String.class);
    assertThat(stored).isNotNull().isNotEqualTo("EAAG_secret_long_lived");

    // 폴러가 쓸 수 있어야 하므로 읽을 때는 평문으로 돌아와야 한다.
    Tournament found = repository.findById("tourn_pg_token").orElseThrow();
    assertThat(found.getDelivery().getAccessToken()).isEqualTo("EAAG_secret_long_lived");
  }

  @Test
  void 라운드_순서가_영속된다() {
    save("tourn_pg_order");

    Tournament found = repository.findById("tourn_pg_order").orElseThrow();
    // @OrderColumn 이 없으면 Set 처럼 순서가 뒤섞여 캐스케이드가 어긋난다.
    assertThat(found.getRounds()).extracting(TourRound::getIndex).containsExactly(1, 2, 3);
    assertThat(found.getRounds()).extracting(TourRound::getRawWinner).containsExactly("A", "B", null);
  }

  @Test
  void 재저장해도_자식이_누적되지_않는다() {
    save("tourn_pg_dup");

    // 컨트롤러의 upsert 와 같은 경계를 준다 — deleteBy… 파생 쿼리는 트랜잭션 안에서만 돈다.
    // orphanRemoval 이 자식 행까지 실제로 지우는지가 이 테스트의 요점이다.
    transactions.executeWithoutResult(
        s -> {
          repository.deleteByIdAndOwnerKey("tourn_pg_dup", "pg@example.com");
          repository.flush();
        });
    save("tourn_pg_dup");

    Integer rounds =
        jdbc.queryForObject(
            "select count(*) from tour_rounds where tournament_id = 'tourn_pg_dup'", Integer.class);
    assertThat(rounds).isEqualTo(3);
  }
}
