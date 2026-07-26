package ai.adflow.api.store.product;

import ai.adflow.api.store.ItemRequest;
import ai.adflow.api.store.ItemsResponse;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * StoreController 를 못 쓴다 — brandProfileId 스코프가 한 겹 더 붙고 정렬 키가 다르다.
 *
 * <p>owner 는 항상 JWT subject 에서 온다. 요청 본문의 값은 신뢰하지 않는다.
 */
@RestController
@RequestMapping("/stores/products")
public class ProductController {

  private final ProductRepository repository;

  public ProductController(ProductRepository repository) {
    this.repository = repository;
  }

  @GetMapping
  public ItemsResponse<Product> list(
      @AuthenticationPrincipal Jwt jwt, @RequestParam("brandProfileId") String brandProfileId) {
    return new ItemsResponse<>(
        repository.findByOwnerKeyAndBrandProfileIdOrderByCreatedAtAsc(
            jwt.getSubject(), brandProfileId));
  }

  @PostMapping
  @Transactional
  public Map<String, Boolean> upsert(
      @AuthenticationPrincipal Jwt jwt, @RequestBody ItemRequest<Product> body) {

    Product item = body.item();
    if (item == null || item.getId() == null || item.getId().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "저장할 항목이 없어요.");
    }
    // 없으면 어떤 목록에도 안 잡히는 유령 행이 된다.
    if (item.getBrandProfileId() == null || item.getBrandProfileId().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "브랜드 프로필이 없어요.");
    }

    item.setOwnerKey(jwt.getSubject());
    item.setUpdatedAt(Instant.now());

    // 지우고 새로 넣는다 — StoreController 와 같은 이유(클라가 항상 전체 문서를 보낸다).
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
