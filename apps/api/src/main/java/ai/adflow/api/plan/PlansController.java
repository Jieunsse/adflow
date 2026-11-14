package ai.adflow.api.plan;

import ai.adflow.api.notification.Notifications;
import ai.adflow.api.security.Role;
import ai.adflow.api.store.ItemsResponse;
import ai.adflow.api.store.brand.BrandProfileRepository;
import ai.adflow.api.workspace.Member;
import ai.adflow.api.workspace.MemberRepository;
import ai.adflow.api.workspace.Workspaces;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** 직원의 월간 계획 만들기·승인 요청·요청 취소 (기능 12-1·12-2, 정책서 11.4). 쓰기는 팀장과 팀원·게재만 한다. */
@RestController
@RequestMapping("/plans")
public class PlansController {

  public record SaveRequest(Long budgetCap, String bundles, String messageToClient) {}

  private static final int MAX_BUNDLES = 20000;
  private static final int MAX_MESSAGE = 500;
  private static final int MAX_MESSAGE_LINES = 3;

  private final MonthlyPlanRepository repository;
  private final BrandProfileRepository profiles;
  private final MemberRepository members;
  private final Workspaces workspaces;
  private final Notifications notifications;
  private final ObjectMapper json;
  private final Clock clock;

  public PlansController(
      MonthlyPlanRepository repository,
      BrandProfileRepository profiles,
      MemberRepository members,
      Workspaces workspaces,
      Notifications notifications,
      ObjectMapper json,
      Clock clock) {
    this.repository = repository;
    this.profiles = profiles;
    this.members = members;
    this.workspaces = workspaces;
    this.notifications = notifications;
    this.json = json;
    this.clock = clock;
  }

  /** brandProfileId·month 를 주면 거른다. 안 주면 워크스페이스 전체다. */
  @GetMapping
  public ItemsResponse<MonthlyPlan> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(value = "brandProfileId", required = false) String brandProfileId,
      @RequestParam(value = "month", required = false) String month) {
    return new ItemsResponse<>(
        repository.findByOwnerKeyOrderByUpdatedAtDesc(workspaces.idOf(jwt)).stream()
            .filter(p -> brandProfileId == null || brandProfileId.equals(p.getBrandProfileId()))
            .filter(p -> month == null || month.equals(p.getMonth()))
            .toList());
  }

  @GetMapping("/{brandProfileId}/{month}")
  public MonthlyPlan get(
      @AuthenticationPrincipal Jwt jwt, @PathVariable String brandProfileId, @PathVariable String month) {
    return load(workspaces.current(jwt.getSubject()), brandProfileId, month);
  }

  /** 임시 저장. 계획이 아직 없으면 만든다. 요청한 뒤에는 고칠 수 없다. */
  @PutMapping("/{brandProfileId}/{month}")
  @Transactional
  public MonthlyPlan save(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable String brandProfileId,
      @PathVariable String month,
      @RequestBody SaveRequest body) {
    Member me = requireEditor(jwt);
    checkMonth(month);
    requireBrand(me, brandProfileId);
    MonthlyPlan p =
        repository
            .findById(MonthlyPlanRepository.idOf(brandProfileId, month))
            .filter(x -> me.getWorkspaceId().equals(x.getOwnerKey()))
            .orElseGet(
                () -> {
                  MonthlyPlan n = new MonthlyPlan();
                  n.setId(MonthlyPlanRepository.idOf(brandProfileId, month));
                  n.setOwnerKey(me.getWorkspaceId());
                  n.setBrandProfileId(brandProfileId);
                  n.setMonth(month);
                  n.setStatus(MonthlyPlan.DRAFT);
                  return n;
                });
    if (!MonthlyPlan.DRAFT.equals(p.getStatus())) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "요청한 뒤에는 고칠 수 없어요. 요청을 취소하거나 다시 만들기를 눌러 주세요.");
    }
    if (body.budgetCap() != null && body.budgetCap() < 0) {
      throw bad("총예산 상한은 0원 이상으로 적어 주세요.");
    }
    p.setBudgetCap(body.budgetCap());
    p.setBundles(checkBundles(body.bundles()));
    p.setMessageToClient(checkMessage(body.messageToClient()));
    p.setUpdatedAt(clock.instant());
    return repository.save(p);
  }

  /** 고객에게 승인을 요청한다. 그 브랜드의 고객 전원에게 알림이 간다. */
  @PostMapping("/{brandProfileId}/{month}/request")
  @Transactional
  public MonthlyPlan request(
      @AuthenticationPrincipal Jwt jwt, @PathVariable String brandProfileId, @PathVariable String month) {
    Member me = requireEditor(jwt);
    MonthlyPlan p = load(me, brandProfileId, month);
    if (!MonthlyPlan.DRAFT.equals(p.getStatus())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 요청했거나 결정된 계획이에요. 화면을 새로 고쳐 주세요.");
    }
    if (p.getBudgetCap() == null || p.getBudgetCap() <= 0) {
      throw bad("총예산 상한을 1원 이상 적은 뒤에 요청해 주세요.");
    }
    p.setStatus(MonthlyPlan.REQUESTED);
    p.setRequestedBy(me.getEmail());
    p.setRequestedAt(clock.instant().toString());
    p.setRejectReason(null);
    p.setUpdatedAt(clock.instant());
    repository.save(p);

    List<String> clients =
        members
            .findByWorkspaceIdAndRoleAndBrandProfileIdAndRemovedAtIsNull(
                me.getWorkspaceId(), Role.CLIENT, brandProfileId)
            .stream()
            .map(Member::getEmail)
            .toList();
    notifications.send(
        clients,
        me.getWorkspaceId(),
        "plan-requested",
        month + " 광고 계획을 확인해 주세요. 승인하시면 담당자가 그 안에서 광고를 올려요.",
        "/portal/plans/" + month,
        "plan-requested:" + p.getId() + ":" + p.getRequestedAt());
    return p;
  }

  @PostMapping("/{brandProfileId}/{month}/cancel")
  @Transactional
  public MonthlyPlan cancel(
      @AuthenticationPrincipal Jwt jwt, @PathVariable String brandProfileId, @PathVariable String month) {
    return back(jwt, brandProfileId, month, MonthlyPlan.REQUESTED, "승인을 요청한 계획만 취소할 수 있어요.");
  }

  /**
   * 승인·반려된 계획을 고치려고 작성 중으로 되돌린다. 승인한 사람·시각은 지우지 않고, 새 요청에 대한 고객의
   * 결정이 덮어쓴다. 되돌린 동안에는 승인된 계획이 없는 것으로 본다.
   */
  @PostMapping("/{brandProfileId}/{month}/reopen")
  @Transactional
  public MonthlyPlan reopen(
      @AuthenticationPrincipal Jwt jwt, @PathVariable String brandProfileId, @PathVariable String month) {
    Member me = requireEditor(jwt);
    MonthlyPlan p = load(me, brandProfileId, month);
    if (!MonthlyPlan.APPROVED.equals(p.getStatus()) && !MonthlyPlan.REJECTED.equals(p.getStatus())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "승인되거나 반려된 계획만 다시 만들 수 있어요.");
    }
    return setDraft(p);
  }

  private MonthlyPlan back(Jwt jwt, String brandProfileId, String month, String from, String message) {
    Member me = requireEditor(jwt);
    MonthlyPlan p = load(me, brandProfileId, month);
    if (!from.equals(p.getStatus())) throw new ResponseStatusException(HttpStatus.CONFLICT, message);
    return setDraft(p);
  }

  private MonthlyPlan setDraft(MonthlyPlan p) {
    p.setStatus(MonthlyPlan.DRAFT);
    p.setUpdatedAt(clock.instant());
    return repository.save(p);
  }

  private Member requireEditor(Jwt jwt) {
    Member me = workspaces.current(jwt.getSubject());
    if (me.getRole() != Role.LEAD && me.getRole() != Role.MEMBER_PUBLISH) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "월간 계획은 팀장과 팀원·게재만 고칠 수 있어요. 팀장에게 요청해 주세요.");
    }
    return me;
  }

  private void requireBrand(Member me, String brandProfileId) {
    profiles
        .findById(brandProfileId)
        .filter(b -> me.getWorkspaceId().equals(b.getOwnerKey()))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "브랜드를 찾지 못했어요."));
  }

  private MonthlyPlan load(Member me, String brandProfileId, String month) {
    return repository
        .findById(MonthlyPlanRepository.idOf(brandProfileId, month))
        .filter(p -> me.getWorkspaceId().equals(p.getOwnerKey()))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "월간 계획을 찾지 못했어요."));
  }

  private static void checkMonth(String month) {
    try {
      YearMonth.parse(month);
    } catch (DateTimeParseException e) {
      throw bad("달은 2026-12 형식으로 적어 주세요.");
    }
  }

  private String checkBundles(String bundles) {
    if (bundles == null || bundles.isBlank()) return "[]";
    if (bundles.length() > MAX_BUNDLES) throw bad("실험 묶음이 너무 많아요. 몇 개를 줄여 주세요.");
    try {
      if (!json.readTree(bundles).isArray()) throw bad("실험 묶음 형식을 확인해 주세요.");
    } catch (JacksonException e) {
      throw bad("실험 묶음 형식을 확인해 주세요.");
    }
    return bundles;
  }

  private static String checkMessage(String message) {
    if (message == null || message.isBlank()) return null;
    String m = message.trim();
    if (m.length() > MAX_MESSAGE || m.lines().count() > MAX_MESSAGE_LINES) {
      throw bad("고객에게 하는 말은 3줄, 500자 이하로 적어 주세요.");
    }
    return m;
  }

  private static ResponseStatusException bad(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }
}
