package ai.adflow.api.store.material;

import ai.adflow.api.store.OwnerScopedRepository;
import java.util.List;

public interface ReferenceMaterialRepository extends OwnerScopedRepository<ReferenceMaterial> {

  /** 화면이 최신 업로드부터 보여준다(기존 Supabase 라우트의 uploaded_at desc 를 승계). */
  List<ReferenceMaterial> findByOwnerKeyAndBrandProfileIdOrderByUploadedAtDesc(
      String ownerKey, String brandProfileId);
}
