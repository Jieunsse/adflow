package ai.adflow.api.store.campaign;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import ai.adflow.api.store.creator.Performance;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class CampaignPostgresIT extends IntegrationTestBase {

  @Autowired private InfluencerCampaignRepository repository;
  @Autowired private JdbcTemplate jdbc;

  @Test
  void 충돌_회피_컬럼이_실제로_두_개다() {
    List<String> columns =
        jdbc.queryForList(
            "select column_name from information_schema.columns where table_name = 'campaign_entries' order by 1",
            String.class);
    // 조인 컬럼과 임베더블 컬럼이 공존해야 한다.
    assertThat(columns).contains("campaign_id", "perf_campaign_id", "creator_id", "position");
  }

  @Test
  void 인라인_성과가_왕복한다() {
    Performance p = new Performance();
    p.setCampaignId("camp_pg");
    p.setRevenue(900000.0);

    CampaignEntry e = new CampaignEntry();
    e.setCreatorId("cr_1");
    e.setStage(CampaignStage.settled);
    e.setPerformance(p);
    e.setUpdatedAt("2026-06-20T00:00:00Z");

    InfluencerCampaign c = new InfluencerCampaign();
    c.setId("camp_pg");
    c.setOwnerKey("pg@example.com");
    c.setUpdatedAt(Instant.now());
    c.setName("여름");
    c.setEntries(new ArrayList<>(List.of(e)));
    repository.saveAndFlush(c);

    var found = repository.findById("camp_pg").orElseThrow();
    assertThat(found.getEntries()).hasSize(1);
    assertThat(found.getEntries().get(0).getPerformance().getCampaignId()).isEqualTo("camp_pg");
    assertThat(found.getEntries().get(0).getStage()).isEqualTo(CampaignStage.settled);
  }
}
