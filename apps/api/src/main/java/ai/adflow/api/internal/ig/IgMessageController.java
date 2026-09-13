package ai.adflow.api.internal.ig;

import ai.adflow.api.store.ItemsResponse;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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

  public IgMessageController(IgMessageRepository repository) {
    this.repository = repository;
  }

  @PostMapping
  @Transactional
  public Map<String, Boolean> upsert(@RequestBody BulkRequest body) {
    if (body == null || body.items() == null || body.items().size() > 1000) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DM 메시지 목록이 올바르지 않아요.");
    }
    for (IgMessage item : body.items()) {
      if (item == null || blank(item.getId()) || blank(item.getIgUserId())
          || blank(item.getConversationId()) || blank(item.getParticipantId())
          || item.getFromMe() == null || blank(item.getCreatedAt())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DM 메시지 필수값이 없어요.");
      }
    }
    // id 가 Meta 의 mid 라 save 가 곧 중복 제거다.
    if (!body.items().isEmpty()) repository.saveAll(body.items());
    return Map.of("ok", true);
  }

  private static boolean blank(String value) {
    return value == null || value.isBlank();
  }

  @GetMapping
  public ItemsResponse<IgMessage> list(
      @RequestParam("igUserId") String igUserId,
      @RequestParam(value = "conversationId", required = false) String conversationId) {

    // 인박스는 최신순(대화별 첫 줄이 미리보기), 스레드는 오래된 순(읽는 순서).
    return new ItemsResponse<>(
        conversationId == null
            ? repository.findByIgUserIdOrderByCreatedAtDesc(igUserId)
            : repository.findByIgUserIdAndConversationIdOrderByCreatedAtAsc(
                igUserId, conversationId));
  }

  @GetMapping("/conversation-id")
  public ResponseEntity<Map<String, String>> conversationId(
      @RequestParam("igUserId") String igUserId, @RequestParam("participantId") String participantId) {

    return repository
        .findFirstByIgUserIdAndParticipantIdOrderByCreatedAtDesc(igUserId, participantId)
        .map(m -> ResponseEntity.ok(Map.of("conversationId", m.getConversationId())))
        .orElseGet(() -> ResponseEntity.noContent().build());
  }
}
