package ai.adflow.api.tournament;

import ai.adflow.api.workspace.Workspaces;
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
  private final Workspaces workspaces;
  private final LaunchApprovalService approvals;

  public TournamentController(
      TournamentRepository repository, Workspaces workspaces, LaunchApprovalService approvals) {
    this.repository = repository;
    this.workspaces = workspaces;
    this.approvals = approvals;
  }

  public record RejectRequest(String reason) {}

  /** 다음 실험 게재 요청 (기능 7). 직원 누구나. */
  @PostMapping("/{id}/launch-request")
  public Tournament requestLaunch(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    return approvals.request(workspaces.current(jwt.getSubject()), id);
  }

  /** 승인하면 바로 Meta 에 올린다. 전송이 실패한 요청은 같은 경로로 다시 시도한다. */
  @PostMapping("/{id}/launch-request/approve")
  public Tournament approveLaunch(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    return approvals.approve(workspaces.current(jwt.getSubject()), id);
  }

  @PostMapping("/{id}/launch-request/reject")
  public Tournament rejectLaunch(
      @AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody RejectRequest body) {
    return approvals.reject(workspaces.current(jwt.getSubject()), id, body.reason());
  }

  @GetMapping
  public ItemsResponse<Tournament> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(value = "brandProfileId", required = false) String brandProfileId) {

    List<Tournament> items =
        brandProfileId == null
            ? repository.findByOwnerKeyOrderByCreatedAtDesc(workspaces.idOf(jwt))
            : repository.findByOwnerKeyAndBrandProfileIdOrderByCreatedAtDesc(
                workspaces.idOf(jwt), brandProfileId);
    return new ItemsResponse<>(items);
  }

  @GetMapping("/{id}")
  public ResponseEntity<Tournament> get(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    return repository
        .findById(id)
        .filter(t -> workspaces.idOf(jwt).equals(t.getOwnerKey()))
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

    item.setOwnerKey(workspaces.idOf(jwt));
    item.setUpdatedAt(Instant.now());

    // 지우고 새로 넣는다 — 클라가 항상 전체 애그리거트를 보내므로 자식 컬렉션의 고아 처리와
    // detached 병합 함정을 통째로 피한다(StoreController 와 같은 판단).
    repository.deleteByIdAndOwnerKey(item.getId(), workspaces.idOf(jwt));
    repository.flush();
    repository.save(item);

    return Map.of("ok", true);
  }

  @DeleteMapping
  @Transactional
  public Map<String, Boolean> remove(
      @AuthenticationPrincipal Jwt jwt, @RequestParam("id") String id) {
    repository.deleteByIdAndOwnerKey(id, workspaces.idOf(jwt));
    return Map.of("ok", true);
  }
}
