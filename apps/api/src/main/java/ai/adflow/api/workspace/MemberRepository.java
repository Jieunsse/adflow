package ai.adflow.api.workspace;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberRepository extends JpaRepository<Member, String> {

  List<Member> findByWorkspaceIdAndRemovedAtIsNullOrderByJoinedAtAsc(String workspaceId);
}
