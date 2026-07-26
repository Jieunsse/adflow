package ai.adflow.api.internal.ig;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IgMessageRepository extends JpaRepository<IgMessage, String> {

  /** 인박스 — 대화별 최신 1건을 화면이 골라 쓴다. */
  List<IgMessage> findByIgUserIdOrderByCreatedAtDesc(String igUserId);

  /** 스레드 — igUserId 로 함께 걸러야 남의 대화가 안 나온다. */
  List<IgMessage> findByIgUserIdAndConversationIdOrderByCreatedAtAsc(
      String igUserId, String conversationId);

  /** webhook 의 대화 id 역조회. Meta 는 webhook 에 conversation_id 를 주지 않는다. */
  Optional<IgMessage> findFirstByIgUserIdAndParticipantIdOrderByCreatedAtDesc(
      String igUserId, String participantId);
}
