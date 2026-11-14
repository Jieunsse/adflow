package ai.adflow.api.portal;

import ai.adflow.api.notification.Notifications;
import ai.adflow.api.security.Role;
import ai.adflow.api.store.brand.BrandProfileRepository;
import ai.adflow.api.workspace.Member;
import ai.adflow.api.workspace.MemberRepository;
import ai.adflow.api.workspace.Workspaces;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.LocalDate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** 직원이 성과 리포트를 고객에게 공유한다 (기능명세 6-1 "고객에게 공유"). 같은 브랜드·기간을 다시 공유하면 덮어쓴다. */
@RestController
@RequestMapping("/reports")
public class ReportShareController {

  public record ShareRequest(
      String brandProfileId, String kind, String rangeStart, String rangeEnd, String metricsJson,
      String reasonsJson, String nextSteps) {}

  private final SharedReportRepository reports;
  private final BrandProfileRepository profiles;
  private final MemberRepository members;
  private final Workspaces workspaces;
  private final Notifications notifications;
  private final Clock clock;

  public ReportShareController(
      SharedReportRepository reports, BrandProfileRepository profiles, MemberRepository members,
      Workspaces workspaces, Notifications notifications, Clock clock) {
    this.reports = reports;
    this.profiles = profiles;
    this.members = members;
    this.workspaces = workspaces;
    this.notifications = notifications;
    this.clock = clock;
  }

  @PostMapping("/share")
  @Transactional
  public SharedReport share(@AuthenticationPrincipal Jwt jwt, @RequestBody ShareRequest body) {
    Member me = workspaces.current(jwt.getSubject());
    if (body.brandProfileId() == null
        || profiles.findById(body.brandProfileId()).filter(p -> me.getWorkspaceId().equals(p.getOwnerKey())).isEmpty()) {
      throw bad("브랜드를 찾지 못했어요. 브랜드를 다시 골라 주세요.");
    }
    if (!"weekly".equals(body.kind()) && !"monthly".equals(body.kind())) throw bad("주간이나 월간을 골라 주세요.");
    try {
      LocalDate.parse(body.rangeStart());
      LocalDate.parse(body.rangeEnd());
    } catch (RuntimeException e) {
      throw bad("리포트 기간을 확인해 주세요.");
    }

    String id = body.brandProfileId() + "_" + body.kind() + "_" + body.rangeStart();
    SharedReport r = reports.findById(id).filter(x -> me.getWorkspaceId().equals(x.getOwnerKey())).orElseGet(SharedReport::new);
    r.setId(id);
    r.setOwnerKey(me.getWorkspaceId());
    r.setBrandProfileId(body.brandProfileId());
    r.setKind(body.kind());
    r.setRangeStart(body.rangeStart());
    r.setRangeEnd(body.rangeEnd());
    r.setMetricsJson(body.metricsJson());
    r.setReasonsJson(body.reasonsJson());
    r.setNextSteps(body.nextSteps());
    r.setSharedBy(me.getEmail());
    r.setSharedAt(clock.instant().toString());
    r.setUpdatedAt(clock.instant());
    SharedReport saved = reports.save(r);

    notifications.send(
        members.findByWorkspaceIdAndRoleAndBrandProfileIdAndRemovedAtIsNull(me.getWorkspaceId(), Role.CLIENT, body.brandProfileId())
            .stream().map(Member::getEmail).toList(),
        me.getWorkspaceId(), "report-shared",
        (body.kind().equals("weekly") ? "주간" : "월간") + " 성과 리포트(" + body.rangeStart() + "~" + body.rangeEnd() + ")가 공유됐어요.",
        "/portal/reports/" + id, "report-shared:" + id + ":" + saved.getSharedAt());
    return saved;
  }

  private static ResponseStatusException bad(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }
}
