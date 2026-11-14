package ai.adflow.api.notification;

import ai.adflow.api.security.Role;
import ai.adflow.api.workspace.Member;
import ai.adflow.api.workspace.MemberRepository;
import java.time.Clock;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** 앱 알림 보내기 (정책서 17.1). 실패해도 본래 일(승인·판정)을 깨지 않도록 부르는 쪽이 감싼다. */
@Service
public class Notifications {

  private static final int NAME_LIMIT = 40;
  private static final int REASON_LIMIT = 80;

  private final NotificationRepository repository;
  private final MemberRepository members;
  private final Clock clock;

  public Notifications(NotificationRepository repository, MemberRepository members, Clock clock) {
    this.repository = repository;
    this.members = members;
    this.clock = clock;
  }

  public void send(
      Collection<String> recipients, String workspaceId, String kind, String message, String link, String dedupeKey) {
    Set<String> unique = new LinkedHashSet<>();
    recipients.stream().filter(r -> r != null && !r.isBlank()).map(r -> r.trim().toLowerCase()).forEach(unique::add);
    for (String to : unique) {
      if (repository.existsByRecipientEmailAndDedupeKey(to, dedupeKey)) continue;
      repository.save(
          new Notification(
              UUID.randomUUID().toString(), to, workspaceId, kind, message, link, dedupeKey, clock.instant()));
    }
  }

  /** 승인할 수 있는 사람 — 팀장과 팀원·게재 (17.1 "승인 요청"). */
  public List<String> approvers(String workspaceId) {
    return members.findByWorkspaceIdAndRemovedAtIsNullOrderByJoinedAtAsc(workspaceId).stream()
        .filter(m -> m.getRole() == Role.LEAD || m.getRole() == Role.MEMBER_PUBLISH)
        .map(Member::getEmail)
        .toList();
  }

  public List<String> leads(String workspaceId) {
    return members.findByWorkspaceIdAndRemovedAtIsNullOrderByJoinedAtAsc(workspaceId).stream()
        .filter(m -> m.getRole() == Role.LEAD)
        .map(Member::getEmail)
        .toList();
  }

  /** 알림 속 광고 이름은 40자, 이유는 80자에서 자른다 (17.2). */
  public static String name(String s) {
    return cut(s, NAME_LIMIT);
  }

  public static String reason(String s) {
    return cut(s, REASON_LIMIT);
  }

  private static String cut(String s, int max) {
    if (s == null) return "";
    return s.length() <= max ? s : s.substring(0, max) + "…";
  }
}
