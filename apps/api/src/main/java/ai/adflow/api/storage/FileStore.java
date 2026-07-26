package ai.adflow.api.storage;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * 버킷 파일 저장. 로컬은 파일시스템, 배포하면 S3 호환으로 갈아끼운다(설계 §5).
 *
 * <p>구현체가 하나뿐이라 인터페이스를 뽑지 않았다. 표면이 넷뿐이라 나중에 뽑는 비용이 거의 없다.
 *
 * <p>경로는 {bucket}/{brandProfileId}/{name} 3세그먼트로 고정한다. 세그먼트마다 화이트리스트를
 * 통과해야 하므로 ".." 도 인코딩된 슬래시도 루트를 벗어나지 못한다.
 */
@Component
public class FileStore {

  /** 설계 §5 의 버킷 2개. 이 목록 밖은 받지 않는다. */
  private static final Set<String> BUCKETS = Set.of("product-images", "reference-materials");

  private static final Pattern SEGMENT = Pattern.compile("[A-Za-z0-9._-]{1,128}");

  private final Path root;

  public FileStore(@Value("${app.storage.root}") String root) {
    this.root = Path.of(root).toAbsolutePath().normalize();
  }

  /** 검증된 상대 경로. DB 에 담기는 값이기도 하다 — 절대 URL 을 저장하지 않는다. */
  public String relativePath(String bucket, String brandProfileId, String name) {
    requireSegment(bucket);
    requireSegment(brandProfileId);
    requireSegment(name);
    if (!BUCKETS.contains(bucket)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알 수 없는 버킷이에요.");
    }
    return bucket + "/" + brandProfileId + "/" + name;
  }

  public void save(String relativePath, byte[] bytes) {
    Path target = resolve(relativePath);
    try {
      Files.createDirectories(target.getParent());
      Files.write(target, bytes);
    } catch (IOException e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "파일을 저장하지 못했어요.", e);
    }
  }

  public Optional<byte[]> read(String relativePath) {
    Path target = resolve(relativePath);
    if (!Files.isRegularFile(target)) return Optional.empty();
    try {
      return Optional.of(Files.readAllBytes(target));
    } catch (IOException e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "파일을 읽지 못했어요.", e);
    }
  }

  public void delete(String relativePath) {
    try {
      Files.deleteIfExists(resolve(relativePath));
    } catch (IOException e) {
      // 지우기 실패는 본업을 막지 않는다 — 고아 파일이 남을 뿐이다.
    }
  }

  private Path resolve(String relativePath) {
    Path target = root.resolve(relativePath).normalize();
    // 세그먼트 검증을 이미 통과했으므로 여기 걸릴 일이 없다. 두 번째 자물쇠다.
    if (!target.startsWith(root)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "잘못된 경로예요.");
    }
    return target;
  }

  private static void requireSegment(String s) {
    if (s == null || !SEGMENT.matcher(s).matches()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "잘못된 경로예요.");
    }
  }
}
