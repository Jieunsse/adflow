package ai.adflow.api.store;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

@NoRepositoryBean
public interface OwnerScopedRepository<T extends OwnerScoped> extends JpaRepository<T, String> {

  List<T> findByOwnerKeyOrderByUpdatedAtDesc(String ownerKey);

  /** id 만으로 지우지 않는다 — 남의 행을 지울 수 있게 된다. */
  void deleteByIdAndOwnerKey(String id, String ownerKey);
}
