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
}
