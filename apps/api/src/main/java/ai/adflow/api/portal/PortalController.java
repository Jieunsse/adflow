package ai.adflow.api.portal;

import ai.adflow.api.brand.BrandConnection;
import ai.adflow.api.brand.BrandConnectionRepository;
import ai.adflow.api.learning.Learning;
import ai.adflow.api.learning.LearningRepository;
import ai.adflow.api.learning.Learnings;
import ai.adflow.api.plan.MonthlyPlan;
import ai.adflow.api.plan.MonthlyPlanRepository;
import ai.adflow.api.store.brand.BrandProfile;
import ai.adflow.api.store.brand.BrandProfileRepository;
import ai.adflow.api.tournament.SpendGuard;
import ai.adflow.api.tournament.TourRound;
import ai.adflow.api.tournament.Tournament;
import ai.adflow.api.tournament.TournamentRepository;
import ai.adflow.api.workspace.Member;
import ai.adflow.api.workspace.Workspaces;
import java.time.Clock;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 고객 화면이 읽는 것 (기능 11, 정책서 5.1). 고객 역할만 들어오고(SecurityConfig), 자기 브랜드 하나만 본다.
 * 진행 중 실험은 이기고 있는 쪽이 드러나지 않게 성과 숫자를 싣지 않는다. 배운 것은 확정한 것, 리포트는 공유한 것만.
 */
@RestController
@RequestMapping("/portal")
public class PortalController {

  public record Variant(String headline, String primaryText) {}

  public record Experiment(
      String id, String productName, String hypothesis, String axis, String launchedAt, Integer impressionShortfall,
      Variant champion, Variant challenger) {}

  public record Overview(
      String brandName, String managerEmail, String month, String planStatus, Long budgetCap, double monthSpend,
      int runningExperiments, List<Learning> recentLearnings) {}

  private static final ZoneId KST = ZoneId.of("Asia/Seoul");

  private final Workspaces workspaces;
  private final BrandProfileRepository profiles;
  private final BrandConnectionRepository connections;
  private final MonthlyPlanRepository plans;
  private final TournamentRepository tournaments;
  private final LearningRepository learnings;
  private final SharedReportRepository reports;
  private final SpendGuard spend;
  private final Clock clock;

  public PortalController(
      Workspaces workspaces, BrandProfileRepository profiles, BrandConnectionRepository connections,
      MonthlyPlanRepository plans, TournamentRepository tournaments, LearningRepository learnings,
      SharedReportRepository reports, SpendGuard spend, Clock clock) {
    this.workspaces = workspaces;
    this.profiles = profiles;
    this.connections = connections;
    this.plans = plans;
    this.tournaments = tournaments;
    this.learnings = learnings;
    this.reports = reports;
    this.spend = spend;
    this.clock = clock;
  }

  @GetMapping("/overview")
  public Overview overview(@AuthenticationPrincipal Jwt jwt) {
    Member me = client(jwt);
    String ws = me.getWorkspaceId();
    String brand = me.getBrandProfileId();
    String month = YearMonth.now(clock.withZone(KST)).toString();
    MonthlyPlan plan =
        plans.findById(MonthlyPlanRepository.idOf(brand, month))
            .filter(p -> ws.equals(p.getOwnerKey()))
            .filter(p -> !MonthlyPlan.DRAFT.equals(p.getStatus())) // 작성 중인 계획은 고객에게 보이지 않는다
            .orElse(null);
    return new Overview(
        profiles.findById(brand).map(BrandProfile::getName).orElse("브랜드"),
        connections.findById(brand).map(BrandConnection::getManagerEmail).orElse(null),
        month,
        plan == null ? null : plan.getStatus(),
        plan == null ? null : plan.getBudgetCap(),
        spend.monthSpend(ws, brand),
        running(ws, brand).size(),
        confirmed(ws, brand).stream().limit(3).toList());
  }

  @GetMapping("/experiments")
  public Map<String, List<Experiment>> experiments(@AuthenticationPrincipal Jwt jwt) {
    Member me = client(jwt);
    return Map.of(
        "items",
        running(me.getWorkspaceId(), me.getBrandProfileId()).stream()
            .map(t -> {
              TourRound r = t.getRounds().stream().filter(x -> "running".equals(x.getStatus())).findFirst().orElseThrow();
              return new Experiment(
                  t.getId(), t.getProductName(),
                  r.getHypothesis() == null ? null : r.getHypothesis().getStatement(),
                  r.getAxis(), r.getLaunchedAt(), r.getImpressionShortfall(),
                  variant(r.getChampion()), variant(r.getChallenger()));
            })
            .toList());
  }

  @GetMapping("/learnings")
  public Map<String, List<Learning>> learnings(@AuthenticationPrincipal Jwt jwt) {
    Member me = client(jwt);
    return Map.of("items", confirmed(me.getWorkspaceId(), me.getBrandProfileId()));
  }

  @GetMapping("/reports")
  public Map<String, List<SharedReport>> reports(@AuthenticationPrincipal Jwt jwt) {
    Member me = client(jwt);
    return Map.of("items", reports.findByOwnerKeyAndBrandProfileIdOrderByRangeStartDesc(me.getWorkspaceId(), me.getBrandProfileId()));
  }

  @GetMapping("/reports/{id}")
  public SharedReport report(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    Member me = client(jwt);
    return reports.findById(id)
        .filter(r -> me.getWorkspaceId().equals(r.getOwnerKey()) && me.getBrandProfileId().equals(r.getBrandProfileId()))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "리포트를 찾지 못했어요."));
  }

  private Member client(Jwt jwt) {
    Member me = workspaces.current(jwt.getSubject());
    if (me.getBrandProfileId() == null) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "연결된 브랜드가 없어요. 담당자에게 확인해 주세요.");
    }
    return me;
  }

  private List<Tournament> running(String ws, String brand) {
    return tournaments.findByOwnerKeyAndBrandProfileIdOrderByCreatedAtDesc(ws, brand).stream()
        .filter(t -> t.getRounds().stream().anyMatch(r -> "running".equals(r.getStatus())))
        .toList();
  }

  private List<Learning> confirmed(String ws, String brand) {
    return learnings.findByOwnerKeyAndBrandProfileIdOrderByCreatedAtDesc(ws, brand).stream()
        .filter(l -> Learnings.CONFIRMED.equals(l.getStatus()))
        .toList();
  }

  private static Variant variant(Tournament.Variant v) {
    return v == null ? null : new Variant(v.getHeadline(), v.getPrimaryText());
  }
}
