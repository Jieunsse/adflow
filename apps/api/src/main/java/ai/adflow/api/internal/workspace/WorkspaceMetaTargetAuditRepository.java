package ai.adflow.api.internal.workspace;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceMetaTargetAuditRepository
    extends JpaRepository<WorkspaceMetaTargetAudit, Long> {

  List<WorkspaceMetaTargetAudit> findAllByOrderByIdAsc();
}
