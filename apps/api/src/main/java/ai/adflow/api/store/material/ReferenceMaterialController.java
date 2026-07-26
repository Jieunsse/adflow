package ai.adflow.api.store.material;

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

/** ProductController 와 같은 모양이다. 정렬 키만 다르다(최신 업로드 먼저). */
@RestController
@RequestMapping("/stores/reference-materials")
public class ReferenceMaterialController {

  private final ReferenceMaterialRepository repository;

  public ReferenceMaterialController(ReferenceMaterialRepository repository) {
    this.repository = repository;
  }

  @GetMapping
  public ItemsResponse<ReferenceMaterial> list(
      @AuthenticationPrincipal Jwt jwt, @RequestParam("brandProfileId") String brandProfileId) {
    return new ItemsResponse<>(
        repository.findByOwnerKeyAndBrandProfileIdOrderByUploadedAtDesc(
            jwt.getSubject(), brandProfileId));
  }

  @PostMapping
  @Transactional
  public Map<String, Boolean> upsert(
      @AuthenticationPrincipal Jwt jwt, @RequestBody ItemRequest<ReferenceMaterial> body) {

    ReferenceMaterial item = body.item();
    if (item == null || item.getId() == null || item.getId().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "저장할 항목이 없어요.");
    }
    if (item.getBrandProfileId() == null || item.getBrandProfileId().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "브랜드 프로필이 없어요.");
    }

    item.setOwnerKey(jwt.getSubject());
    item.setUpdatedAt(Instant.now());
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
