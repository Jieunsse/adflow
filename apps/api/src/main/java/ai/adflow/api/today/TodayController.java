package ai.adflow.api.today;

import ai.adflow.api.client.Billing;
import ai.adflow.api.learning.Learning;
import ai.adflow.api.learning.LearningRepository;
import ai.adflow.api.learning.Learnings;
import ai.adflow.api.plan.MonthlyPlan;
import ai.adflow.api.plan.MonthlyPlanRepository;
import ai.adflow.api.security.Role;
import ai.adflow.api.store.brand.BrandProfile;
import ai.adflow.api.store.brand.BrandProfileRepository;
import ai.adflow.api.tournament.TourRound;
import ai.adflow.api.tournament.Tournament;
import ai.adflow.api.tournament.TournamentRepository;
import ai.adflow.api.workspace.Member;
import ai.adflow.api.workspace.MemberRepository;
import ai.adflow.api.workspace.Workspaces;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.Duration;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 오늘의 결정 중 사람이 해야 하는 일 (기능 5, 정책서 15.1의 1·2순위). 성과 숫자에서 나오는 3순위 이하는 웹이
 * 기존 규칙(action-queue)으로 만든다. brandProfileId 를 주면 그 브랜드만, 안 주면 워크스페이스 전체다.
 */
@RestController
@RequestMapping("/today")
public class TodayController {

  /** 오늘의 결정 카드 한 장. amount 는 같은 순위 안에서 큰 것부터 보여 주는 기준이다(정책서 15.1). */
  public record Decision(
      String key, int priority, String brandProfileId, String brandName, String title, String body, String link,
      String action, double amount) {}

  public record DismissRequest(String key) {}

  private static final ZoneId KST = ZoneId.of("Asia/Seoul");
  private static final Duration SNOOZE = Duration.ofDays(7);

  private final Workspaces workspaces;
  private final TournamentRepository tournaments;
  private final LearningRepository learnings;
  private final MonthlyPlanRepository plans;
  private final MemberRepository members;
  private final BrandProfileRepository profiles;
  private final Billing billing;
  private final DismissalRepository dismissals;
  private final Clock clock;

  public TodayController(
      Workspaces workspaces,
      TournamentRepository tournaments,
      LearningRepository learnings,
      MonthlyPlanRepository plans,
      MemberRepository members,
      BrandProfileRepository profiles,
      Billing billing,
      DismissalRepository dismissals,
      Clock clock) {
    this.workspaces = workspaces;
    this.tournaments = tournaments;
    this.learnings = learnings;
    this.plans = plans;
    this.members = members;
    this.profiles = profiles;
    this.billing = billing;
    this.dismissals = dismissals;
    this.clock = clock;
  }

  @GetMapping
  public Map<String, List<Decision>> today(
      @AuthenticationPrincipal Jwt jwt, @RequestParam(value = "brandProfileId", required = false) String brandId) {
    Member me = workspaces.current(jwt.getSubject());
    String ws = me.getWorkspaceId();
    Map<String, String> names =
        profiles.findByOwnerKeyOrderByUpdatedAtDesc(ws).stream()
            .collect(Collectors.toMap(BrandProfile::getId, p -> p.getName() == null ? "브랜드" : p.getName(), (a, b) -> a));
    Function<String, String> name = id -> names.getOrDefault(id, "브랜드");
    List<Decision> out = new ArrayList<>();

    for (Tournament t : tournaments.findByOwnerKeyOrderByCreatedAtDesc(ws)) {
      if (brandId != null && !brandId.equals(t.getBrandProfileId())) continue;
      if ("completed".equals(t.getStatus())) continue;
      String b = t.getBrandProfileId();
      String link = "/ab-tests/" + t.getId();
      double budget = t.getDailyBudget() == null ? 0 : t.getDailyBudget();
      String status = t.getLaunchRequest() == null ? null : t.getLaunchRequest().getStatus();
      if (t.getLastError() != null) {
        // 1순위 — 광고가 멈췄거나 돈이 새는 일.
        out.add(new Decision("stopped:" + t.getId(), 1, b, name.apply(b),
            "'" + t.getProductName() + "' 실험이 멈췄어요", t.getLastError(), link, "확인하기", budget));
        continue;
      }
      if ("pending".equals(status)) {
        out.add(new Decision("launch-pending:" + t.getId() + ":" + t.getLaunchRequest().getRequestedAt(), 2, b, name.apply(b),
            "'" + t.getProductName() + "' 다음 실험이 승인을 기다려요",
            t.getLaunchRequest().getRequestedBy() + "님이 게재를 요청했어요.", link, "승인하러 가기", budget));
      }
      TourRound last = t.getRounds().isEmpty() ? null : t.getRounds().get(t.getRounds().size() - 1);
      if (last != null && "unjudgeable".equals(last.getStatus())) {
        int short_ = last.getImpressionShortfall() == null ? 0 : last.getImpressionShortfall();
        out.add(new Decision("unjudgeable:" + t.getId() + ":" + last.getIndex(), 2, b, name.apply(b),
            "'" + t.getProductName() + "' 실험을 판정하지 못했어요",
            "노출이 " + String.format("%,d", short_) + "회 모자라요. 기간이나 하루 예산을 늘릴지 정해 주세요.", link, "실험 보기", budget));
      }
    }

    Map<String, Long> drafts =
        learnings.findByOwnerKeyOrderByUpdatedAtDesc(ws).stream()
            .filter(l -> Learnings.DRAFT.equals(l.getStatus()))
            .filter(l -> brandId == null || brandId.equals(l.getBrandProfileId()))
            .collect(Collectors.groupingBy(Learning::getBrandProfileId, Collectors.counting()));
    drafts.forEach((b, n) -> out.add(new Decision("drafts:" + b + ":" + n, 2, b, name.apply(b),
        "확정하지 않은 배운 것이 " + n + "개 있어요", "확정한 것만 다음 실험을 만들 때 써요.", "/learnings", "확인하러 가기", 0)));

    // 대행 브랜드(고객이 있는 브랜드)에 이번 달 승인된 계획이 없으면 새 실험을 올릴 수 없다 (정책서 11.4).
    String month = YearMonth.now(clock.withZone(KST)).toString();
    members.findByWorkspaceIdAndRemovedAtIsNullOrderByJoinedAtAsc(ws).stream()
        .filter(m -> m.getRole() == Role.CLIENT && m.getBrandProfileId() != null)
        .map(Member::getBrandProfileId)
        .distinct()
        .filter(b -> brandId == null || brandId.equals(b))
        .filter(b -> plans.findById(MonthlyPlanRepository.idOf(b, month))
            .filter(p -> MonthlyPlan.APPROVED.equals(p.getStatus())).isEmpty())
        .forEach(b -> out.add(new Decision("no-plan:" + b + ":" + month, 2, b, name.apply(b),
            "이번 달 광고 계획이 승인되지 않았어요", "승인된 계획이 없으면 새 실험을 게재할 수 없어요.",
            "/plans/" + b + "/" + month, "계획 보러 가기", 0)));

    // 입금 지연은 팀장에게만 (기능명세 5-1).
    if (me.getRole() == Role.LEAD) {
      for (String b : names.keySet()) {
        if (brandId != null && !brandId.equals(b)) continue;
        long days = billing.overdueDays(ws, b);
        if (days > 0) {
          out.add(new Decision("overdue:" + b, 2, b, name.apply(b),
              "입금이 " + days + "일 늦어지고 있어요", "30일을 넘기면 새 실험을 게재할 수 없어요.", "/clients", "고객사 보러 가기", days));
        }
      }
    }

    var now = clock.instant();
    List<Decision> visible =
        out.stream()
            .filter(d -> d.priority() == 1
                || dismissals.findById(me.getEmail() + "|" + d.key()).map(x -> x.getUntil().isBefore(now)).orElse(true))
            .sorted(Comparator.comparingInt(Decision::priority).thenComparing(Comparator.comparingDouble(Decision::amount).reversed()))
            .toList();
    return Map.of("items", visible);
  }

  /** "나중에" — 같은 근거로 7일 동안 다시 보여 주지 않는다. 1순위는 미룰 수 없다 (정책서 15.1). */
  @PostMapping("/dismiss")
  @Transactional
  public Map<String, Boolean> dismiss(@AuthenticationPrincipal Jwt jwt, @RequestBody DismissRequest body) {
    Member me = workspaces.current(jwt.getSubject());
    if (body.key() == null || body.key().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "미룰 카드를 찾지 못했어요.");
    }
    if (body.key().startsWith("stopped:")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "멈춘 실험은 미룰 수 없어요. 원인을 확인해 주세요.");
    }
    dismissals.save(new Dismissal(me.getEmail() + "|" + body.key(), clock.instant().plus(SNOOZE)));
    return Map.of("ok", true);
  }
}
