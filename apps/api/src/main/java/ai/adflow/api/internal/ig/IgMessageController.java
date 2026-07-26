package ai.adflow.api.internal.ig;

import ai.adflow.api.internal.InternalSecret;
import ai.adflow.api.store.ItemsResponse;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 인스타 DM 캐시.
 *
 * <p>Meta webhook 은 세션 없이 호출하고 읽기 경로는 세션이 있지만, 호출자가 전부 Next.js 서버라
 * 문을 하나로 둔다 — 내부 시크릿 하나면 충분하고 인증 모드가 갈라지지 않는다.
 *
 * <p>읽기는 항상 igUserId 로 거른다. 대화 id 만으로 조회하면 남의 스레드가 나온다.
 */
@RestController
@RequestMapping("/internal/ig-messages")
public class IgMessageController {

  public record BulkRequest(List<IgMessage> items) {}

  private final IgMessageRepository repository;
  private final InternalSecret internalSecret;

  public IgMessageController(IgMessageRepository repository, InternalSecret internalSecret) {
    this.repository = repository;
    this.internalSecret = internalSecret;
  }

  @PostMapping
  @Transactional
  public Map<String, Boolean> upsert(
      @RequestHeader(value = "X-Internal-Secret", required = false) String presented,
      @RequestBody BulkRequest body) {

    internalSecret.require(presented);

    // id 가 Meta 의 mid 라 save 가 곧 중복 제거다.
    if (body.items() != null && !body.items().isEmpty()) repository.saveAll(body.items());
    return Map.of("ok", true);
  }

  @GetMapping
  public ItemsResponse<IgMessage> list(
      @RequestHeader(value = "X-Internal-Secret", required = false) String presented,
      @RequestParam("igUserId") String igUserId,
      @RequestParam(value = "conversationId", required = false) String conversationId) {

    internalSecret.require(presented);

    // 인박스는 최신순(대화별 첫 줄이 미리보기), 스레드는 오래된 순(읽는 순서).
    return new ItemsResponse<>(
        conversationId == null
            ? repository.findByIgUserIdOrderByCreatedAtDesc(igUserId)
            : repository.findByIgUserIdAndConversationIdOrderByCreatedAtAsc(
                igUserId, conversationId));
  }

  @GetMapping("/conversation-id")
  public ResponseEntity<Map<String, String>> conversationId(
      @RequestHeader(value = "X-Internal-Secret", required = false) String presented,
      @RequestParam("igUserId") String igUserId,
      @RequestParam("participantId") String participantId) {

    internalSecret.require(presented);

    return repository
        .findFirstByIgUserIdAndParticipantIdOrderByCreatedAtDesc(igUserId, participantId)
        .map(m -> ResponseEntity.ok(Map.of("conversationId", m.getConversationId())))
        .orElseGet(() -> ResponseEntity.noContent().build());
  }
}
