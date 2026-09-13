package ai.adflow.api.internal.workspace;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceMetaTargetRepository extends JpaRepository<WorkspaceMetaTarget, String> {

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select t from WorkspaceMetaTarget t where t.id = :id")
  Optional<WorkspaceMetaTarget> findForUpdate(@Param("id") String id);
}
