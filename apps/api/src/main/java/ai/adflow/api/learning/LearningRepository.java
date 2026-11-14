package ai.adflow.api.learning;

import ai.adflow.api.store.OwnerScopedRepository;
import java.util.List;

public interface LearningRepository extends OwnerScopedRepository<Learning> {

  List<Learning> findByOwnerKeyAndBrandProfileIdOrderByCreatedAtDesc(String ownerKey, String brandProfileId);

  List<Learning> findByTournamentIdInAndStatus(List<String> tournamentIds, String status);
}
