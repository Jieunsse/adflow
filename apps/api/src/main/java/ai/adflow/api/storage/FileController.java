package ai.adflow.api.storage;

import ai.adflow.api.store.brand.BrandProfileRepository;
import ai.adflow.api.internal.InternalSecret;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
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
  private final InternalSecret internalSecret;

  public FileController(FileStore store, BrandProfileRepository brandProfiles, InternalSecret internalSecret) {
    this.store = store;
    this.brandProfiles = brandProfiles;
    this.internalSecret = internalSecret;
  }

  @CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.PUT, RequestMethod.OPTIONS})
  @GetMapping("/published-media/{name}")
  public ResponseEntity<byte[]> readPublished(@PathVariable String name) {
    String path = store.publishedPath(name);
    return store
        .read(path)
        .map(bytes -> ResponseEntity.ok().contentType(guessType(name)).body(bytes))
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  @CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.PUT, RequestMethod.OPTIONS})
  @PutMapping("/published-media/{name}")
  public Map<String, String> writePublished(
      @PathVariable String name,
      @RequestParam(required = false) String expires,
      @RequestParam(required = false) String signature,
      @RequestHeader(value = HttpHeaders.CONTENT_TYPE, required = false) String contentType,
      @RequestBody byte[] bytes) {
    if (!internalSecret.matchesSignedUpload("PUT", "/files/published-media/" + name, expires, signature)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "업로드 권한이 만료됐어요.");
    }
    validatePublished(name, contentType, bytes);
    String path = store.publishedPath(name);
    store.saveNew(path, bytes);
    return Map.of("path", path);
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
    if (lower.endsWith(".mp4")) return MediaType.parseMediaType("video/mp4");
    if (lower.endsWith(".mov")) return MediaType.parseMediaType("video/quicktime");
    if (lower.endsWith(".webm")) return MediaType.parseMediaType("video/webm");
    if (lower.endsWith(".pdf")) return MediaType.APPLICATION_PDF;
    if (lower.endsWith(".txt")) return MediaType.TEXT_PLAIN;
    return MediaType.APPLICATION_OCTET_STREAM;
  }

  private static void validatePublished(String name, String contentType, byte[] bytes) {
    String lower = name.toLowerCase(Locale.ROOT);
    String mime = contentType == null ? "" : contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
    if (!mime.equals(guessType(name).toString())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "파일 MIME 형식이 확장자와 맞지 않아요.");
    }
    long max = lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".webm")
        ? 100L * 1024 * 1024
        : 8L * 1024 * 1024;
    if (bytes.length < 1 || bytes.length > max || !matchesSource(bytes, mime)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "파일 형식이나 크기가 올바르지 않아요.");
    }
  }

  private static boolean matchesSource(byte[] bytes, String mime) {
    if (mime.equals("image/png")) return startsWith(bytes, new int[] {0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a});
    if (mime.equals("image/jpeg")) return startsWith(bytes, new int[] {0xff, 0xd8, 0xff});
    if (mime.equals("image/webp")) return startsWith(bytes, new int[] {0x52, 0x49, 0x46, 0x46}) && startsWith(bytes, new int[] {0x57, 0x45, 0x42, 0x50}, 8);
    if (mime.equals("video/webm")) return startsWith(bytes, new int[] {0x1a, 0x45, 0xdf, 0xa3});
    return startsWith(bytes, new int[] {0x66, 0x74, 0x79, 0x70}, 4);
  }

  private static boolean startsWith(byte[] bytes, int[] signature) {
    return startsWith(bytes, signature, 0);
  }

  private static boolean startsWith(byte[] bytes, int[] signature, int offset) {
    if (bytes.length < offset + signature.length) return false;
    for (int i = 0; i < signature.length; i++) {
      if ((bytes[offset + i] & 0xff) != signature[i]) return false;
    }
    return true;
  }
}
