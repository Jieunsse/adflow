package ai.adflow.api.storage;

import ai.adflow.api.store.brand.BrandProfileRepository;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 버킷 파일의 유일한 문.
 *
 * <p>인가는 브랜드 프로필 소유에 물려 있다 — 경로에 brandProfileId 가 들어 있으므로 별도 소유
 * 테이블이 필요 없고, 행이 아직 없는 신규 업로드에도 그대로 통한다.
 *
 * <p>인가가 파일 존재 확인보다 <b>앞선다.</b> 순서가 바뀌면 남의 파일 유무가 404/403 차이로 샌다.
 */
@RestController
@RequestMapping("/files")
public class FileController {

  private final FileStore store;
  private final BrandProfileRepository brandProfiles;

  public FileController(FileStore store, BrandProfileRepository brandProfiles) {
    this.store = store;
    this.brandProfiles = brandProfiles;
  }

  @GetMapping("/{bucket}/{brandProfileId}/{name}")
  public ResponseEntity<byte[]> read(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable String bucket,
      @PathVariable String brandProfileId,
      @PathVariable String name) {

    String path = authorize(jwt, bucket, brandProfileId, name);
    return store
        .read(path)
        .map(bytes -> ResponseEntity.ok().contentType(guessType(name)).body(bytes))
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  @PutMapping("/{bucket}/{brandProfileId}/{name}")
  public Map<String, String> write(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable String bucket,
      @PathVariable String brandProfileId,
      @PathVariable String name,
      @RequestBody byte[] bytes) {

    String path = authorize(jwt, bucket, brandProfileId, name);
    store.save(path, bytes);
    // 응답이 곧 DB 에 담길 값이다. 절대 URL 이 아니라 상대 경로다(설계 §5).
    return Map.of("path", path);
  }

  @DeleteMapping("/{bucket}/{brandProfileId}/{name}")
  public Map<String, Boolean> remove(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable String bucket,
      @PathVariable String brandProfileId,
      @PathVariable String name) {

    store.delete(authorize(jwt, bucket, brandProfileId, name));
    return Map.of("ok", true);
  }

  private String authorize(Jwt jwt, String bucket, String brandProfileId, String name) {
    String path = store.relativePath(bucket, brandProfileId, name);
    boolean mine =
        brandProfiles
            .findById(brandProfileId)
            .map(bp -> jwt.getSubject().equals(bp.getOwnerKey()))
            .orElse(false);
    if (!mine) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "이 브랜드 프로필의 파일이 아니에요.");
    }
    return path;
  }

  private static MediaType guessType(String name) {
    String lower = name.toLowerCase();
    if (lower.endsWith(".png")) return MediaType.IMAGE_PNG;
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return MediaType.IMAGE_JPEG;
    if (lower.endsWith(".webp")) return MediaType.parseMediaType("image/webp");
    if (lower.endsWith(".pdf")) return MediaType.APPLICATION_PDF;
    if (lower.endsWith(".txt")) return MediaType.TEXT_PLAIN;
    return MediaType.APPLICATION_OCTET_STREAM;
  }
}
