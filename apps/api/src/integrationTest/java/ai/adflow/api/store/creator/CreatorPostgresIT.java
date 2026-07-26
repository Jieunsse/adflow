package ai.adflow.api.store.creator;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class CreatorPostgresIT extends IntegrationTestBase {

  @Autowired private CreatorRepository repository;
  @Autowired private JdbcTemplate jdbc;

  @Test
  void 컬렉션이_별도_테이블로_펼쳐진다() {
    List<String> tables =
        jdbc.queryForList(
            "select table_name from information_schema.tables where table_schema='public' order by 1",
            String.class);
    assertThat(tables).contains("creators", "creator_categories", "creator_performances");
  }

  @Test
  void 성과이력이_행으로_저장되고_순서가_보존된다() {
    Performance p1 = new Performance();
    p1.setCampaignId("camp_1");
    p1.setReach(1000);
    Performance p2 = new Performance();
    p2.setCampaignId("camp_2");
    p2.setReach(2000);

    Creator c = new Creator();
    c.setId("cr_pg");
    c.setOwnerKey("pg@example.com");
    c.setUpdatedAt(Instant.now());
    c.setHandle("@pg");
    c.setPlatform(CreatorPlatform.instagram);
    c.setCategory(new ArrayList<>(List.of("뷰티", "푸드")));
    c.setPerformanceHistory(new ArrayList<>(List.of(p1, p2)));
    repository.saveAndFlush(c);

    Integer rows =
        jdbc.queryForObject(
            "select count(*) from creator_performances where creator_id = 'cr_pg'", Integer.class);
    assertThat(rows).isEqualTo(2);

    assertThat(repository.findById("cr_pg").orElseThrow().getPerformanceHistory())
        .extracting(Performance::getCampaignId)
        .containsExactly("camp_1", "camp_2");
  }
}
