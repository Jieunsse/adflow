package ai.adflow.api.tournament;

import ai.adflow.api.store.ItemRequest;
import ai.adflow.api.store.ItemsResponse;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 실유저 토너먼트 CRUD.
 *
 * <p>StoreController 를 못 쓴다 — 개별 조회(GET /{id})가 필요하고 brandProfileId 스코프가 더 붙는다.
 * owner 는 항상 JWT subject 에서 온다.
 */
@RestController
@RequestMapping("/stores/tournaments")
public class TournamentController {

  private final TournamentRepository repository;

  public TournamentController(TournamentRepository repository) {
    this.repository = repository;
  }

  @GetMapping
  public ItemsResponse<Tournament> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(value = "brandProfileId", required = false) String brandProfileId) {

    List<Tournament> items =
        brandProfileId == null
            ? repository.findByOwnerKeyOrderByCreatedAtDesc(jwt.getSubject())
            : repository.findByOwnerKeyAndBrandProfileIdOrderByCreatedAtDesc(
                jwt.getSubject(), brandProfileId);
    return new ItemsResponse<>(items);
  }

  @GetMapping("/{id}")
  public ResponseEntity<Tournament> get(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    return repository
        .findById(id)
        .filter(t -> jwt.getSubject().equals(t.getOwnerKey()))
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  @PostMapping
  @Transactional
  public Map<String, Boolean> upsert(
      @AuthenticationPrincipal Jwt jwt, @RequestBody ItemRequest<Tournament> body) {

    Tournament item = body.item();
    if (item == null || item.getId() == null || item.getId().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "저장할 항목이 없어요.");
    }
    if (item.getBrandProfileId() == null || item.getBrandProfileId().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "브랜드 프로필이 없어요.");
    }

    item.setOwnerKey(jwt.getSubject());
    item.setUpdatedAt(Instant.now());

    // 지우고 새로 넣는다 — 클라가 항상 전체 애그리거트를 보내므로 자식 컬렉션의 고아 처리와
    // detached 병합 함정을 통째로 피한다(StoreController 와 같은 판단).
    repository.deleteByIdAndOwnerKey(item.getId(), jwt.getSubject());
    repository.flush();
    repository.save(item);

    return Map.of("ok", true);
  }

  @DeleteMapping
  @Transactional
  public Map<String, Boolean> remove(
      @AuthenticationPrincipal Jwt jwt, @RequestParam("id") String id) {
    repository.deleteByIdAndOwnerKey(id, jwt.getSubject());
    return Map.of("ok", true);
  }
}
