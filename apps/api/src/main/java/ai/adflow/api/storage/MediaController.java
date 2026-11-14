package ai.adflow.api.storage;

import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 인스타그램 게시용 사진·영상. Meta 는 게시할 파일을 공개 주소에서 직접 가져가므로, 올리기는 직원만 하고 읽기는
 * 누구나 한다(SecurityConfig). 파일 이름은 웹이 정한 무작위 UUID 라 주소를 짐작할 수 없다.
 *
 * <p>shortcut: 게시가 끝난 파일을 지우지 않는다. 쌓이면 오래된 파일을 지우는 정리 작업을 둔다.
 */
@RestController
public class MediaController {

  private static final String BUCKET = "published-media";
  private static final String FOLDER = "all";
  private static final Pattern NAME = Pattern.compile("[0-9a-f-]{36}\\.(jpg|png|webp|mp4|mov|webm)");
  private static final long MAX_IMAGE = 8L * 1024 * 1024;
  private static final long MAX_VIDEO = 100L * 1024 * 1024;
  private static final Map<String, String> TYPES =
      Map.of(
          "jpg", "image/jpeg", "png", "image/png", "webp", "image/webp",
          "mp4", "video/mp4", "mov", "video/quicktime", "webm", "video/webm");

  private final FileStore store;

  public MediaController(FileStore store) {
    this.store = store;
  }

  @PutMapping("/media/{name}")
  public Map<String, String> upload(
      @PathVariable String name,
      @RequestHeader(value = "Content-Type", required = false) String contentType,
      @RequestBody byte[] bytes) {
    String type = typeOf(name);
    if (contentType == null || !contentType.toLowerCase().startsWith(type)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "파일 형식이 이름과 맞지 않아요.");
    }
    long max = type.startsWith("video/") ? MAX_VIDEO : MAX_IMAGE;
    if (bytes.length == 0 || bytes.length > max) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, type.startsWith("video/") ? "100MB 이하 영상만 올릴 수 있어요." : "파일이 8MB 를 넘었거나 비어 있어요.");
    }
    store.save(store.relativePath(BUCKET, FOLDER, name), bytes);
    return Map.of("name", name);
  }

  @GetMapping("/public/media/{name}")
  public ResponseEntity<byte[]> read(@PathVariable String name) {
    String type = typeOf(name);
    return store
        .read(store.relativePath(BUCKET, FOLDER, name))
        .map(b -> ResponseEntity.ok().contentType(MediaType.parseMediaType(type)).body(b))
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  private static String typeOf(String name) {
    if (name == null || !NAME.matcher(name).matches()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "파일 이름이 올바르지 않아요.");
    }
    return TYPES.get(name.substring(name.lastIndexOf('.') + 1));
  }
}
