package ai.adflow.api.timelog;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TimeEntryRepository extends JpaRepository<TimeEntry, String> {

  List<TimeEntry> findByWorkspaceIdAndWorkDateBetweenOrderByWorkDateDesc(String workspaceId, String from, String to);
}
