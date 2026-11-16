package ai.adflow.api.connection;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.security.Role;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MetaConnectionRepositoryTest {

  private static final String PLAIN_TOKEN = "EAAG-super-secret-meta-token";

  @Autowired private MetaConnectionRepository repository;
  @Autowired private JdbcTemplate jdbcTemplate;

  private MetaConnection sample() {
    MetaConnection c = new MetaConnection();
    c.setOwnerKey("owner@example.com");
    c.setEmail("owner@example.com");
    c.setRole(Role.LEAD);
    c.setAccessToken(PLAIN_TOKEN);
    c.setAdAccountId("act_123");
    c.setUpdatedAt(Instant.now());
    return c;
  }

  @Test
  void 저장하고_읽으면_토큰이_복호화된다() {
    repository.saveAndFlush(sample());
    MetaConnection found = repository.findById("owner@example.com").orElseThrow();
    assertThat(found.getAccessToken()).isEqualTo(PLAIN_TOKEN);
    assertThat(found.getAdAccountId()).isEqualTo("act_123");
    assertThat(found.getRole()).isEqualTo(Role.LEAD);
  }

  @Test
  void DB에_저장된_토큰은_평문이_아니다() {
    repository.saveAndFlush(sample());
    String stored =
        jdbcTemplate.queryForObject(
            "select access_token from meta_connections where owner_key = ?",
            String.class,
            "owner@example.com");
    assertThat(stored).isNotNull();
    assertThat(stored).isNotEqualTo(PLAIN_TOKEN);
    assertThat(stored).doesNotContain("EAAG");
  }

  @Test
  void 같은_평문을_두번_암호화하면_다른_값이_나온다() {
    MetaConnection first = sample();
    first.setOwnerKey("a@example.com");
    repository.saveAndFlush(first);

    MetaConnection second = sample();
    second.setOwnerKey("b@example.com");
    repository.saveAndFlush(second);

    String storedA =
        jdbcTemplate.queryForObject(
            "select access_token from meta_connections where owner_key = ?",
            String.class,
            "a@example.com");
    String storedB =
        jdbcTemplate.queryForObject(
            "select access_token from meta_connections where owner_key = ?",
            String.class,
            "b@example.com");

    // IV 가 매번 달라야 한다. 같으면 같은 평문이 같은 암호문이 되어 패턴이 드러난다.
    assertThat(storedA).isNotEqualTo(storedB);
  }
}
