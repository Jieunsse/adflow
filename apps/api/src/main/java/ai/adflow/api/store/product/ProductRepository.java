package ai.adflow.api.store.product;

import ai.adflow.api.store.OwnerScopedRepository;
import java.util.List;

public interface ProductRepository extends OwnerScopedRepository<Product> {

  /** 화면이 오래된 것부터 보여준다(기존 Supabase 라우트의 created_at asc 를 승계). */
  List<Product> findByOwnerKeyAndBrandProfileIdOrderByCreatedAtAsc(
      String ownerKey, String brandProfileId);
}
