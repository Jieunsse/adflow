package ai.adflow.api.store.library;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class LibraryPostgresIT extends IntegrationTestBase {

  @Autowired private LibraryItemRepository repository;
  @Autowired private JdbcTemplate jdbc;

  private LibraryItem sample(String id, String owner) {
    LibraryItem i = new LibraryItem();
    i.setId(id);
    i.setOwnerKey(owner);
    i.setUpdatedAt(Instant.now());
    i.setSavedAt(1753500000000L);
    i.setBrand("그린루틴");
    i.setPrimary("매일 마시는 루틴");
    return i;
  }

  @Test
  void 예약어_컬럼이_실제_Postgres_에서_생성된다() {
    List<String> columns =
        jdbc.queryForList(
            "select column_name from information_schema.columns where table_name = 'library_items' order by 1",
            String.class);
    assertThat(columns).contains("primary_text", "owner_key", "updated_at", "saved_at", "cta_label");
    assertThat(columns).doesNotContain("primary");
  }

  @Test
  void owner_스코프_정렬이_최신순이다() {
    LibraryItem older = sample("cre_old", "sort@example.com");
    older.setUpdatedAt(Instant.parse("2026-01-01T00:00:00Z"));
    LibraryItem newer = sample("cre_new", "sort@example.com");
    newer.setUpdatedAt(Instant.parse("2026-06-01T00:00:00Z"));
    repository.saveAllAndFlush(List.of(older, newer));

    assertThat(repository.findByOwnerKeyOrderByUpdatedAtDesc("sort@example.com"))
        .extracting(LibraryItem::getId)
        .containsExactly("cre_new", "cre_old");
  }
}
