package ai.adflow.api.plan;

import ai.adflow.api.store.OwnerScopedRepository;
import java.util.List;

public interface MonthlyPlanRepository extends OwnerScopedRepository<MonthlyPlan> {

  List<MonthlyPlan> findByOwnerKeyAndBrandProfileIdOrderByMonthDesc(String ownerKey, String brandProfileId);

  static String idOf(String brandProfileId, String month) {
    return brandProfileId + "_" + month;
  }
}
