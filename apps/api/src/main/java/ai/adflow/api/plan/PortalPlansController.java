package ai.adflow.api.plan;

import ai.adflow.api.brand.BrandConnectionRepository;
import ai.adflow.api.notification.Notifications;
import ai.adflow.api.store.ItemsResponse;
import ai.adflow.api.workspace.Member;
import ai.adflow.api.workspace.Workspaces;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 고객의 월간 계획 승인·반려·상한 줄이기 (기능 12-3, 정책서 11.4). 고객은 자기 브랜드의 계획만 본다.
 * 보안 설정이 고객 역할만 이 경로에 들인다.
 */
@RestController
@RequestMapping("/portal/plans")
public class PortalPlansController {

  public record RejectRequest(String reason) {}

  public record CapRequest(Long budgetCap) {}

  private static final int MIN_REJECT_REASON = 1;

  private final MonthlyPlanRepository repository;
  private final BrandConnectionRepository connections;
  private final Workspaces workspaces;
  private final Notifications notifications;
  private final Clock clock;

  public PortalPlansController(
      MonthlyPlanRepository repository,
      BrandConnectionRepository connections,
      Workspaces workspaces,
      Notifications notifications,
      Clock clock) {
    this.repository = repository;
    this.connections = connections;
    this.workspaces = workspaces;
    this.notifications = notifications;
    this.clock = clock;
  }

  /** 작성 중인 계획은 고객에게 보이지 않는다. */
  @GetMapping
  public ItemsResponse<MonthlyPlan> list(@AuthenticationPrincipal Jwt jwt) {
    Member me = workspaces.current(jwt.getSubject());
    return new ItemsResponse<>(
        repository.findByOwnerKeyAndBrandProfileIdOrderByMonthDesc(me.getWorkspaceId(), me.getBrandProfileId()).stream()
            .filter(p -> !MonthlyPlan.DRAFT.equals(p.getStatus()))
            .toList());
  }

  @GetMapping("/{month}")
  public MonthlyPlan get(@AuthenticationPrincipal Jwt jwt, @PathVariable String month) {
    return load(workspaces.current(jwt.getSubject()), month);
  }

  @PostMapping("/{month}/approve")
  @Transactional
  public MonthlyPlan approve(@AuthenticationPrincipal Jwt jwt, @PathVariable String month) {
    Member me = workspaces.current(jwt.getSubject());
    MonthlyPlan p = load(me, month);
    requireRequested(p);
    decide(me, p, MonthlyPlan.APPROVED, null);
    tell(me, p, "plan-approved", month + " 광고 계획을 승인했어요. 총예산 상한은 " + won(p.getBudgetCap()) + "이에요.");
    return p;
  }

  @PostMapping("/{month}/reject")
  @Transactional
  public MonthlyPlan reject(
      @AuthenticationPrincipal Jwt jwt, @PathVariable String month, @RequestBody RejectRequest body) {
    Member me = workspaces.current(jwt.getSubject());
    MonthlyPlan p = load(me, month);
    if (body.reason() == null || body.reason().trim().length() < MIN_REJECT_REASON) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "반려하는 이유를 적어 주세요.");
    }
    requireRequested(p);
    String reason = body.reason().trim();
    decide(me, p, MonthlyPlan.REJECTED, reason.length() > 400 ? reason.substring(0, 400) : reason);
    tell(me, p, "plan-rejected", month + " 광고 계획이 반려됐어요. " + Notifications.reason(reason));
    return p;
  }

  /** 승인 뒤에는 상한을 줄이는 것만 고객이 바로 한다. 늘리려면 담당자가 계획을 다시 요청한다. */
  @PutMapping("/{month}/cap")
  @Transactional
  public MonthlyPlan lowerCap(
      @AuthenticationPrincipal Jwt jwt, @PathVariable String month, @RequestBody CapRequest body) {
    Member me = workspaces.current(jwt.getSubject());
    MonthlyPlan p = load(me, month);
    if (!MonthlyPlan.APPROVED.equals(p.getStatus())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "승인한 계획의 상한만 줄일 수 있어요.");
    }
    if (body.budgetCap() == null || body.budgetCap() < 1) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "총예산 상한을 1원 이상으로 적어 주세요.");
    }
    if (body.budgetCap() > p.getBudgetCap()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "상한은 늘릴 수 없어요. 늘리려면 담당자에게 계획을 다시 요청해 달라고 말씀해 주세요.");
    }
    p.setBudgetCap(body.budgetCap());
    decide(me, p, MonthlyPlan.APPROVED, null);
    tell(me, p, "plan-cap-lowered", month + " 광고 계획의 총예산 상한을 " + won(p.getBudgetCap()) + "으로 줄였어요.");
    return p;
  }

  private void decide(Member me, MonthlyPlan p, String status, String reason) {
    p.setStatus(status);
    p.setDecidedBy(me.getEmail());
    p.setDecidedAt(clock.instant().toString());
    p.setRejectReason(reason);
    p.setUpdatedAt(clock.instant());
    repository.save(p);
  }

  /** 그 브랜드 담당 직원과 팀장에게 알린다 (17.1). */
  private void tell(Member me, MonthlyPlan p, String kind, String message) {
    List<String> to = new ArrayList<>(notifications.leads(me.getWorkspaceId()));
    connections.findById(p.getBrandProfileId()).map(c -> c.getManagerEmail()).ifPresent(to::add);
    notifications.send(
        to, me.getWorkspaceId(), kind, message, "/plans/" + p.getBrandProfileId() + "/" + p.getMonth(),
        kind + ":" + p.getId() + ":" + p.getDecidedAt());
  }

  private static void requireRequested(MonthlyPlan p) {
    if (!MonthlyPlan.REQUESTED.equals(p.getStatus())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "승인을 기다리는 계획이 아니에요. 화면을 새로 고쳐 주세요.");
    }
  }

  private MonthlyPlan load(Member me, String month) {
    String brand = me.getBrandProfileId();
    return repository
        .findById(MonthlyPlanRepository.idOf(brand, month))
        .filter(p -> me.getWorkspaceId().equals(p.getOwnerKey()))
        .filter(p -> !MonthlyPlan.DRAFT.equals(p.getStatus()))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "월간 계획을 찾지 못했어요."));
  }

  private static String won(Long v) {
    return String.format("%,d원", v == null ? 0 : v);
  }
}
