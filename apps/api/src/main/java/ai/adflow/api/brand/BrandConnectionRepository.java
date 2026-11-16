package ai.adflow.api.brand;

import ai.adflow.api.store.OwnerScopedRepository;
import java.util.Optional;

public interface BrandConnectionRepository extends OwnerScopedRepository<BrandConnection> {

  Optional<BrandConnection> findByAdAccountId(String adAccountId);
}
