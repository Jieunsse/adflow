package ai.adflow.api.store.launch;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;

class CampaignLaunchPostgresIT extends IntegrationTestBase {

  @Autowired private CampaignLaunchRepository repository;
  @Autowired private JdbcTemplate jdbc;

  @Test
  void adIds_가_별도_테이블로_펼쳐진다() {
    List<String> tables =
        jdbc.queryForList(
            "select table_name from information_schema.tables where table_schema='public' order by 1",
            String.class);
    assertThat(tables).contains("campaign_launches", "campaign_launch_ad_ids");
  }

  @Test
  void 튜플_순서와_판별유니온이_왕복한다() {
    CampaignLaunch c = new CampaignLaunch();
    c.setCampaignId("camp_pg");
    c.setOwnerKey("pg@example.com");
    c.setUpdatedAt(Instant.now());
    c.setAdSetId("adset_pg");
    c.setAdIds(new ArrayList<>(List.of("ad_a", "ad_b")));
    c.setDailyBudget(30000.0);
    c.setStartDate("2026-07-01");
    c.setEndDate("2026-07-31");
    c.setStatus(LaunchStatus.ACTIVE);
    c.setAbTestAxis(AbTestAxis.headline);
    c.setAbTestVariantB(
        JsonMapper.builder().build().readTree("{\"axis\":\"headline\",\"headline\":\"하루를 여는 한 잔\"}"));
    repository.saveAndFlush(c);

    CampaignLaunch found = repository.findById("camp_pg").orElseThrow();
    assertThat(found.getAdIds()).containsExactly("ad_a", "ad_b");
    assertThat(found.getAbTestVariantB().get("headline").asText()).isEqualTo("하루를 여는 한 잔");
    assertThat(found.getStatus()).isEqualTo(LaunchStatus.ACTIVE);
  }
}
