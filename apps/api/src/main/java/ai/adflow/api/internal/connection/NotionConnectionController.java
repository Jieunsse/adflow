package ai.adflow.api.internal.connection;

import ai.adflow.api.connection.NotionConnection;
import ai.adflow.api.connection.NotionConnectionRepository;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Notion 연결 (ADR-043). 단계 4 에서 유예했다가 단계 7 에 옮겼다.
 *
 * <p>내부 시크릿으로 지킨다 — Notion OAuth 콜백은 Spring JWT 를 들고 오지 않는다. Next 가 세션에서
 * 해석한 userKey 를 파라미터로 넘긴다(CronRunController 와 같은 사정).
 */
@RestController
@RequestMapping("/internal/notion-connections")
public class NotionConnectionController {

  private final NotionConnectionRepository repository;

  public NotionConnectionController(NotionConnectionRepository repository) {
    this.repository = repository;
  }

  /** 연결이 없으면 204 다 — 404 로 두면 호출자가 "고장"과 구분하지 못한다. */
  @GetMapping
  public ResponseEntity<NotionConnection> get(@RequestParam("userKey") String userKey) {
    return repository
        .findById(userKey)
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.noContent().build());
  }

  @PostMapping
  @Transactional
  public Map<String, Boolean> save(
      @RequestParam("userKey") String userKey, @RequestBody NotionConnection body) {

    if (body.getAccessToken() == null || body.getAccessToken().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Notion 액세스 토큰이 없어요.");
    }

    body.setUserKey(userKey);
    body.setUpdatedAt(Instant.now());
    repository.save(body);
    return Map.of("ok", true);
  }

  @DeleteMapping
  @Transactional
  public Map<String, Boolean> remove(@RequestParam("userKey") String userKey) {
    repository.deleteById(userKey);
    return Map.of("ok", true);
  }
}
