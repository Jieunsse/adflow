package ai.adflow.api.internal.tournament;

import ai.adflow.api.internal.InternalSecret;
import ai.adflow.api.store.ItemRequest;
import ai.adflow.api.store.ItemsResponse;
import ai.adflow.api.tournament.Tournament;
import ai.adflow.api.tournament.TournamentRepository;
import ai.adflow.api.tournament.TournamentSettleService;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 실유저 토너먼트의 서버-대-서버 통로. 단계 5 에서 Spring 이 이 도메인의 진실의 원천이 된다.
 *
 * <p>JWT 를 쓰는 {@code /stores/tournaments} 와 나란히 두는 이유 — cron 폴러는 세션 없이 돌아
 * JWT 를 실을 수 없다(CronRunController 와 같은 사정). 소유자는 JWT subject 가 아니라 파라미터로
 * 받는다. 여는 것이 아니라 자물쇠를 바꾸는 것이다.
 */
@RestController
@RequestMapping("/internal/tournaments")
public class InternalTournamentController {

  private final TournamentRepository repository;
  private final TournamentSettleService settleService;
  private final InternalSecret internalSecret;

  public InternalTournamentController(
      TournamentRepository repository,
      TournamentSettleService settleService,
      InternalSecret internalSecret) {
    this.repository = repository;
    this.settleService = settleService;
    this.internalSecret = internalSecret;
  }

  /**
   * status 만 주면 cron 의 전역 스캔, ownerKey 를 주면 유저 소유분, brandProfileId 까지 주면 Ledger
   * 투영 입력(ADR-047)이다. TS TournamentStore 의 list/listByOwner/listByBrandOwner 셋을 한 경로가 받는다.
   */
  @GetMapping
  public ItemsResponse<Tournament> list(
      @RequestHeader(value = "X-Internal-Secret", required = false) String presented,
      @RequestParam(value = "status", required = false) String status,
      @RequestParam(value = "ownerKey", required = false) String ownerKey,
      @RequestParam(value = "brandProfileId", required = false) String brandProfileId) {

    internalSecret.require(presented);

    List<Tournament> items;
    if (ownerKey != null && brandProfileId != null) {
      items = repository.findByOwnerKeyAndBrandProfileIdOrderByCreatedAtDesc(ownerKey, brandProfileId);
    } else if (ownerKey != null) {
      items = repository.findByOwnerKeyOrderByCreatedAtDesc(ownerKey);
    } else if (status != null) {
      items = repository.findByStatusOrderByCreatedAtDesc(status);
    } else {
      items = repository.findAll();
    }
    return new ItemsResponse<>(items);
  }

  @GetMapping("/{id}")
  public ResponseEntity<Tournament> get(
      @RequestHeader(value = "X-Internal-Secret", required = false) String presented,
      @PathVariable String id) {

    internalSecret.require(presented);
    return repository.findById(id).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
  }

  @PostMapping
  @Transactional
  public Map<String, Boolean> upsert(
      @RequestHeader(value = "X-Internal-Secret", required = false) String presented,
      @RequestParam("ownerKey") String ownerKey,
      @RequestBody ItemRequest<Tournament> body) {

    internalSecret.require(presented);

    Tournament item = body.item();
    if (item == null || item.getId() == null || item.getId().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "저장할 항목이 없어요.");
    }
    if (item.getBrandProfileId() == null || item.getBrandProfileId().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "브랜드 프로필이 없어요.");
    }

    item.setOwnerKey(ownerKey);
    item.setUpdatedAt(Instant.now());

    // TournamentController 와 같은 판단 — 클라가 항상 전체 애그리거트를 보내므로 지우고 새로 넣는다.
    repository.deleteByIdAndOwnerKey(item.getId(), ownerKey);
    repository.flush();
    repository.save(item);

    return Map.of("ok", true);
  }

  @DeleteMapping
  @Transactional
  public Map<String, Boolean> remove(
      @RequestHeader(value = "X-Internal-Secret", required = false) String presented,
      @RequestParam("id") String id) {

    internalSecret.require(presented);
    repository.deleteById(id);
    return Map.of("ok", true);
  }

  /** 단계 5 의 종착점 — Java 엔진이 라운드를 결산한다. cron 은 이걸 부르는 얇은 트리거로 남는다. */
  @PostMapping("/{id}/settle")
  public TournamentSettleService.Outcome settle(
      @RequestHeader(value = "X-Internal-Secret", required = false) String presented,
      @PathVariable String id) {

    internalSecret.require(presented);
    return settleService.settle(id);
  }
}
