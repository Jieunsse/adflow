package ai.adflow.api.store;

import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;

/**
 * Synced Store 엔드포인트 4개의 공통 CRUD.
 *
 * 계약은 프론트의 createSyncedStore 가 이미 쓰던 것 그대로다 —
 * GET → {items}, POST {item}, DELETE ?id=. 프론트를 고치지 않으려고 봉투를 승계했다.
 *
 * owner 는 항상 JWT subject 에서 온다. 요청 본문의 값은 신뢰하지 않는다.
 */
public abstract class StoreController<T extends OwnerScoped> {

  private final OwnerScopedRepository<T> repository;

  protected StoreController(OwnerScopedRepository<T> repository) {
    this.repository = repository;
  }

  @GetMapping
  public ItemsResponse<T> list(@AuthenticationPrincipal Jwt jwt) {
    List<T> items = repository.findByOwnerKeyOrderByUpdatedAtDesc(jwt.getSubject());
    return new ItemsResponse<>(items);
  }

  @PostMapping
  @Transactional
  public Map<String, Boolean> upsert(
      @AuthenticationPrincipal Jwt jwt, @RequestBody ItemRequest<T> body) {

    T item = body.item();
    if (item == null || item.getId() == null || item.getId().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "저장할 항목이 없어요.");
    }

    item.setOwnerKey(jwt.getSubject());
    item.setUpdatedAt(Instant.now());

    // 지우고 새로 넣는다. 클라이언트가 항상 전체 문서를 보내므로(createSyncedStore 의 postItem)
    // 병합이 필요 없고, 자식 컬렉션의 고아 처리·detached 병합 함정을 통째로 피한다.
    // ponytail: 애그리거트가 수십 행 규모라 이 방식으로 충분하다. 커지면 병합으로 바꾼다.
    repository.deleteByIdAndOwnerKey(item.getId(), jwt.getSubject());
    repository.flush();
    repository.save(item);

    return Map.of("ok", true);
  }

  @DeleteMapping
  @Transactional
  public ResponseEntity<Map<String, Boolean>> remove(
      @AuthenticationPrincipal Jwt jwt, @RequestParam("id") String id) {
    repository.deleteByIdAndOwnerKey(id, jwt.getSubject());
    return ResponseEntity.ok(Map.of("ok", true));
  }
}
