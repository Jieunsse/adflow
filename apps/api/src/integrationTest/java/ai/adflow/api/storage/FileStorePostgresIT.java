package ai.adflow.api.storage;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import ai.adflow.api.store.material.ReferenceMaterial;
import ai.adflow.api.store.material.ReferenceMaterialRepository;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class FileStorePostgresIT extends IntegrationTestBase {

  @Autowired private FileStore store;
  @Autowired private ReferenceMaterialRepository repository;
  @Autowired private JdbcTemplate jdbc;

  @Test
  void 저장한_바이트가_그대로_돌아온다() {
    String path = store.relativePath("reference-materials", "bp_it", "ref_it.txt");
    store.save(path, "안녕".getBytes(StandardCharsets.UTF_8));

    assertThat(store.read(path)).isPresent();
    assertThat(new String(store.read(path).orElseThrow(), StandardCharsets.UTF_8)).isEqualTo("안녕");

    store.delete(path);
    assertThat(store.read(path)).isEmpty();
  }

  @Test
  void DB_에는_절대_URL_이_아니라_상대_경로가_들어간다() {
    ReferenceMaterial m = new ReferenceMaterial();
    m.setId("ref_pg");
    m.setOwnerKey("pg@example.com");
    m.setUpdatedAt(Instant.now());
    m.setBrandProfileId("bp_pg");
    m.setName("자료.txt");
    m.setType("txt");
    m.setMimeType("text/plain");
    m.setSizeBytes(12L);
    m.setStorageUrl("reference-materials/bp_pg/ref_pg.txt");
    m.setUploadedAt(1L);
    repository.saveAndFlush(m);

    List<String> urls =
        jdbc.queryForList(
            "select storage_url from reference_materials where id = 'ref_pg'", String.class);
    // http 로 시작하면 호스팅을 바꿀 때 DB 마이그레이션이 필요해진다(설계 §5).
    assertThat(urls).singleElement().asString().doesNotStartWith("http");
  }
}
