package ai.adflow.api.tournament;

import ai.adflow.api.store.OwnerScopedRepository;
import java.util.List;

public interface TournamentRepository extends OwnerScopedRepository<Tournament> {

  /** ADR-047 Ledger 투영 입력 — 소유 유저의 같은 Brand Profile 토너먼트만. */
  List<Tournament> findByOwnerKeyAndBrandProfileIdOrderByCreatedAtDesc(
      String ownerKey, String brandProfileId);

  List<Tournament> findByOwnerKeyOrderByCreatedAtDesc(String ownerKey);

  /** cron 폴러의 전역 스캔 — 소유자를 가리지 않는다. 내부 시크릿 경로에서만 부른다. */
  List<Tournament> findByStatusOrderByCreatedAtDesc(String status);
}
