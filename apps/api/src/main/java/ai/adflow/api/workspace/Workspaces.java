package ai.adflow.api.workspace;

import ai.adflow.api.security.Role;
import ai.adflow.api.store.OwnerScopedRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * 로그인한 사람(JWT subject = 이메일)을 소속 워크스페이스와 역할로 바꾼다. 역할은 매 요청 DB 에서
 * 읽는다 — 토큰에 박힌 값을 믿으면 역할을 바꾸거나 내보내도 토큰이 끝날 때까지(1시간) 그대로다.
 */
@Service
public class Workspaces {

  public static final String REMOVED_MESSAGE = "워크스페이스에서 내보내진 계정이에요. 팀장에게 다시 초대를 요청해 주세요.";

  private final MemberRepository members;
  private final WorkspaceRepository workspaces;
  private final List<OwnerScopedRepository<?>> ownerScoped;
  private final TransactionTemplate tx;
  private final Clock clock;

  public Workspaces(
      MemberRepository members,
      WorkspaceRepository workspaces,
      List<OwnerScopedRepository<?>> ownerScoped,
      TransactionTemplate tx,
      Clock clock) {
    this.members = members;
    this.workspaces = workspaces;
    this.ownerScoped = ownerScoped;
    this.tx = tx;
    this.clock = clock;
  }

  public String idOf(Jwt jwt) {
    return current(jwt.getSubject()).getWorkspaceId();
  }

  /** 소속이 없으면 그 사람이 팀장인 새 워크스페이스를 만든다 (정책서 5.2: 만든 사람이 팀장). */
  public Member current(String email) {
    // 로그인 제공자마다 대소문자가 달라도 같은 사람이다 (정책서 3.1: 이메일이 같으면 같은 계정).
    String key = email.trim().toLowerCase();
    Member m = members.findById(key).orElse(null);
    if (m == null) {
      try {
        m = tx.execute(s -> bootstrap(email, key));
      } catch (DataIntegrityViolationException raced) {
        // 첫 요청 두 개가 동시에 왔다. 먼저 만든 쪽을 쓴다.
        m = members.findById(key).orElseThrow(() -> raced);
      }
    }
    if (m.isRemoved()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, REMOVED_MESSAGE);
    }
    return m;
  }

  private Member bootstrap(String email, String key) {
    Instant now = clock.instant();
    String id = "ws_" + UUID.randomUUID();
    workspaces.save(new Workspace(id, key, now));
    // 워크스페이스 도입 전에는 owner_key 가 이메일이었다. 그 사람의 기존 데이터를 새 공간으로 옮긴다.
    ownerScoped.forEach(r -> r.reassignOwner(email, id));
    return members.saveAndFlush(new Member(key, id, Role.LEAD, now));
  }
}
