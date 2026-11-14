package ai.adflow.api.notification;

import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 내 알림 — 최근 30일 (정책서 17.2). shortcut: 30일 지난 행은 지우지 않고 목록에서만 뺀다. 쌓이면 정리 작업을 둔다. */
@RestController
@RequestMapping("/notifications")
public class NotificationsController {

  private final NotificationRepository repository;
  private final Clock clock;

  public NotificationsController(NotificationRepository repository, Clock clock) {
    this.repository = repository;
    this.clock = clock;
  }

  @GetMapping
  public Map<String, List<Notification>> list(@AuthenticationPrincipal Jwt jwt) {
    return Map.of(
        "items",
        repository.findTop100ByRecipientEmailAndCreatedAtAfterOrderByCreatedAtDesc(
            me(jwt), clock.instant().minus(Duration.ofDays(30))));
  }

  @PostMapping("/read-all")
  @Transactional
  public Map<String, Boolean> readAll(@AuthenticationPrincipal Jwt jwt) {
    repository.markAllRead(me(jwt), clock.instant());
    return Map.of("ok", true);
  }

  private static String me(Jwt jwt) {
    return jwt.getSubject().trim().toLowerCase();
  }
}
