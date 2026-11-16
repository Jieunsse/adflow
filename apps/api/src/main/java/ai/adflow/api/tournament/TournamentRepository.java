package ai.adflow.api.tournament;

import ai.adflow.api.store.OwnerScopedRepository;
import java.util.List;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TournamentRepository extends OwnerScopedRepository<Tournament> {

  /** ADR-047 Ledger 투영 입력 — 소유 유저의 같은 Brand Profile 토너먼트만. */
  List<Tournament> findByOwnerKeyAndBrandProfileIdOrderByCreatedAtDesc(
      String ownerKey, String brandProfileId);

  List<Tournament> findByOwnerKeyOrderByCreatedAtDesc(String ownerKey);

  /**
   * 게재 요청 상태를 한 번에 바꾼다. 바뀐 행이 0이면 다른 요청이 먼저 처리했다 — 승인을 두 번 눌러도
   * 광고는 한 번만 만들어진다 (정책서 11.2). 일괄 수정은 @Version 을 올리지 않아 직접 올린다.
   */
  @Modifying(clearAutomatically = true)
  @Query(
      "update Tournament t set t.launchRequest.status = :to, t.version = t.version + 1"
          + " where t.id = :id and t.launchRequest.status in :from")
  int moveLaunchStatus(
      @Param("id") String id, @Param("from") List<String> from, @Param("to") String to);

  /** cron 폴러의 전역 스캔 — 소유자를 가리지 않는다. 내부 시크릿 경로에서만 부른다. */
  List<Tournament> findByStatusOrderByCreatedAtDesc(String status);
}
