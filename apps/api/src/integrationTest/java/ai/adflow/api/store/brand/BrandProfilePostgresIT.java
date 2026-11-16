package ai.adflow.api.store.brand;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

class BrandProfilePostgresIT extends IntegrationTestBase {

  private static final String POLICY =
      "[{\"type\":\"prohibited_words\",\"data\":{\"words\":[\"최저가\"]},\"source\":\"user\"}]";

  @Autowired private BrandProfileRepository repository;
  @Autowired private JdbcTemplate jdbc;

  private BrandProfile sample(String id, String owner) throws Exception {
    LeadMetric lead = new LeadMetric();
    lead.setKind("cpc-max");
    lead.setValue(900.0);
    lead.setSource("derived");

    LagTarget lag = new LagTarget();
    lag.setMetric(GoalMetric.roas);
    lag.setTarget(3.5);

    Goal goal = new Goal();
    goal.setId("goal_1");
    goal.setName("여름 ROAS");
    goal.setLag(lag);
    goal.setLeads(new ArrayList<>(List.of(lead)));

    CopyReference ref = new CopyReference();
    ref.setId("ref_1");
    ref.setText("아침을 바꾸는 한 잔");
    ref.setSource(CopySource.ig);

    BrandProfile bp = new BrandProfile();
    bp.setId(id);
    bp.setOwnerKey(owner);
    bp.setUpdatedAt(Instant.now());
    bp.setName("기본 프로필");
    bp.setIsDefault(true);
    bp.setCopyReferences(new ArrayList<>(List.of(ref)));
    bp.setProofPoints(new ArrayList<>(List.of("재구매율 40%")));
    bp.setGoals(new ArrayList<>(List.of(goal)));
    bp.setPolicy(JsonMapper.builder().build().readTree(POLICY));
    return bp;
  }

  @Test
  void 애그리거트가_다섯_테이블로_펼쳐진다() {
    List<String> tables =
        jdbc.queryForList(
            "select table_name from information_schema.tables where table_schema='public' order by 1",
            String.class);
    assertThat(tables)
        .contains(
            "brand_profiles",
            "brand_profile_copy_references",
            "brand_profile_proof_points",
            "brand_profile_goals",
            "brand_profile_goal_leads");
  }

  @Test
  void 판별유니온_policy_가_텍스트로_왕복한다() throws Exception {
    repository.saveAndFlush(sample("bp_pg", "pg@example.com"));

    var found = repository.findById("bp_pg").orElseThrow();
    assertThat(found.getPolicy().isArray()).isTrue();
    assertThat(found.getPolicy().get(0).get("data").get("words").get(0).asText()).isEqualTo("최저가");
    assertThat(found.getGoals().get(0).getLeads().get(0).getKind()).isEqualTo("cpc-max");
  }

  // 파생 삭제는 트랜잭션이 있어야 한다. 프로덕션 경로는 StoreController 가 @Transactional 이라
  // 문제없고, 리포지토리를 직접 부르는 이 테스트만 트랜잭션을 연다.
  @Test
  @Transactional
  void 프로필을_지우면_자식_행이_함께_사라진다() throws Exception {
    repository.saveAndFlush(sample("bp_del", "del@example.com"));
    assertThat(jdbc.queryForObject("select count(*) from brand_profile_goals", Integer.class))
        .isGreaterThan(0);

    repository.deleteByIdAndOwnerKey("bp_del", "del@example.com");
    repository.flush();

    // 파생 삭제라 cascade 가 돈다. @Modifying @Query 로 바꾸면 이 테스트가 깨진다.
    assertThat(
            jdbc.queryForObject(
                "select count(*) from brand_profile_goals g"
                    + " where not exists (select 1 from brand_profiles p where p.id = g.brand_profile_id)",
                Integer.class))
        .isEqualTo(0);
  }
}
