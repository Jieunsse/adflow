package ai.adflow.api.store.sop;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;

class SopPostgresIT extends IntegrationTestBase {

  private static final String SECTIONS =
      "[{\"type\":\"prohibited_words\",\"data\":{\"words\":[\"최저가\"]},\"source\":\"user\"}]";

  @Autowired private SopRepository repository;
  @Autowired private JdbcTemplate jdbc;

  @Test
  void 도메인_updatedAt_이_서버_정렬키와_다른_컬럼이다() {
    List<String> columns =
        jdbc.queryForList(
            "select column_name from information_schema.columns where table_name = 'sops' order by 1",
            String.class);
    assertThat(columns).contains("updated_at", "domain_updated_at", "sections", "owner_key");
  }

  @Test
  void 판별유니온_sections_가_텍스트로_왕복한다() {
    Sop s = new Sop();
    s.setId("sop_pg");
    s.setOwnerKey("pg@example.com");
    s.setUpdatedAt(Instant.now());
    s.setName("정책");
    s.setCreatedAt("2026-07-01T00:00:00Z");
    s.setDomainUpdatedAt("2026-07-02T00:00:00Z");
    s.setSections(JsonMapper.builder().build().readTree(SECTIONS));
    repository.saveAndFlush(s);

    Sop found = repository.findById("sop_pg").orElseThrow();
    assertThat(found.getSections().isArray()).isTrue();
    assertThat(found.getSections().get(0).get("data").get("words").get(0).asText()).isEqualTo("최저가");
    assertThat(found.getDomainUpdatedAt()).isEqualTo("2026-07-02T00:00:00Z");
  }
}
