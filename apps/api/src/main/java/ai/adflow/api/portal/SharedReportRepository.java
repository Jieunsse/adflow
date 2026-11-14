package ai.adflow.api.portal;

import ai.adflow.api.store.OwnerScopedRepository;
import java.util.List;

public interface SharedReportRepository extends OwnerScopedRepository<SharedReport> {
  List<SharedReport> findByOwnerKeyAndBrandProfileIdOrderByRangeStartDesc(String ownerKey, String brandProfileId);
}
