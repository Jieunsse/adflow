package ai.adflow.api.connection;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import ai.adflow.api.security.Role;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class MetaConnectionPostgresIT extends IntegrationTestBase {

  private static final String PLAIN_TOKEN = "EAAG-super-secret-meta-token";

  @Autowired private MetaConnectionRepository repository;
  @Autowired private NotionConnectionRepository notionRepository;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void 진짜_Postgres16_위에서_돈다() {
    String version = jdbcTemplate.queryForObject("select version()", String.class);
    assertThat(version).contains("PostgreSQL 16");
  }

  @Test
  void 암호화_컬럼이_실제_Postgres_에서도_왕복한다() {
    MetaConnection c = new MetaConnection();
    c.setOwnerKey("pg@example.com");
    c.setEmail("pg@example.com");
    c.setRole(Role.LEAD);
    c.setAccessToken(PLAIN_TOKEN);
    c.setUpdatedAt(Instant.now());
    repository.saveAndFlush(c);

    assertThat(repository.findById("pg@example.com").orElseThrow().getAccessToken())
        .isEqualTo(PLAIN_TOKEN);

    String stored =
        jdbcTemplate.queryForObject(
            "select access_token from meta_connections where owner_key = ?",
            String.class,
            "pg@example.com");
    assertThat(stored).isNotEqualTo(PLAIN_TOKEN);
    assertThat(stored).doesNotContain("EAAG");
  }

  @Test
  void Notion_토큰도_평문으로_저장되지_않는다() {
    // 단계 7 — Supabase 시절엔 평문이었다. 옮기면서 MetaConnection 과 같은 처방을 걸었다.
    NotionConnection n = new NotionConnection();
    n.setUserKey("pg-notion@example.com");
    n.setAccessToken("secret_notion_token");
    n.setWorkspaceName("내 워크스페이스");
    n.setUpdatedAt(Instant.now());
    notionRepository.saveAndFlush(n);

    assertThat(notionRepository.findById("pg-notion@example.com").orElseThrow().getAccessToken())
        .isEqualTo("secret_notion_token");

    String stored =
        jdbcTemplate.queryForObject(
            "select access_token from notion_connections where user_key = ?",
            String.class,
            "pg-notion@example.com");
    assertThat(stored).isNotEqualTo("secret_notion_token");
    assertThat(stored).doesNotContain("secret_notion");
  }
}
