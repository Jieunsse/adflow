package ai.adflow.api.tournament;

import ai.adflow.api.brand.BrandConnection;
import ai.adflow.api.brand.BrandConnectionRepository;
import ai.adflow.api.meta.MetaGraphClient;
import ai.adflow.api.notification.Notifications;
import ai.adflow.api.plan.MonthlyPlan;
import ai.adflow.api.plan.MonthlyPlanRepository;
import ai.adflow.api.security.Role;
import ai.adflow.api.workspace.MemberRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 광고비 자동 멈춤 (기능 13, 정책서 12.1). 사람이 없는 밤·주말에 광고비가 새지 않게 하는 두 번째 방어선이다.
 * 첫 번째 방어선은 Meta 광고 세트의 하루 예산과 광고 계정 지출 한도다. 폴러가 성과를 가져온 직후(6시간마다) 부른다.
 */
@Service
public class SpendGuard {

  public static final String SPEND_ANOMALY = "spend_anomaly";
  public static final String MONTHLY_CAP = "monthly_cap";

  static final String ANOMALY_MESSAGE = "광고비가 하루 예산의 2배를 넘어 멈췄어요. 원인을 확인한 뒤 다시 시작해 주세요.";
  static final String CAP_MESSAGE = "이번 달 예산 상한에 닿아 멈췄어요. 고객에게 상한을 늘려 달라고 요청해 주세요.";

  private static final Logger log = LoggerFactory.getLogger(SpendGuard.class);
  private static final ZoneId KST = ZoneId.of("Asia/Seoul");

  private final TournamentRepository repository;
  private final MonthlyPlanRepository plans;
  private final MemberRepository members;
  private final BrandConnectionRepository brands;
  private final MetaGraphClient graph;
  private final Notifications notifications;
  private final TransactionTemplate tx;
  private final Clock clock;

  public SpendGuard(
      TournamentRepository repository,
      MonthlyPlanRepository plans,
      MemberRepository members,
      BrandConnectionRepository brands,
      MetaGraphClient graph,
      Notifications notifications,
      TransactionTemplate tx,
      Clock clock) {
    this.repository = repository;
    this.plans = plans;
    this.members = members;
    this.brands = brands;
    this.graph = graph;
    this.notifications = notifications;
    this.tx = tx;
    this.clock = clock;
  }

  /** 멈췄으면 true. */
  public boolean check(String tournamentId) {
    Tournament t = repository.findById(tournamentId).orElse(null);
    TourRound r = t == null ? null : running(t);
    if (r == null || t.getLastError() != null) return false;

    if (overspent(t, r)) {
      stop(t.getId(), SPEND_ANOMALY, ANOMALY_MESSAGE);
      return true;
    }
    if (capReached(t.getOwnerKey(), t.getBrandProfileId())) {
      // 상한은 브랜드 단위다. 이 브랜드에서 진행 중인 실험을 모두 멈춘다.
      for (Tournament other :
          repository.findByOwnerKeyAndBrandProfileIdOrderByCreatedAtDesc(t.getOwnerKey(), t.getBrandProfileId())) {
        if (running(other) != null && other.getLastError() == null) stop(other.getId(), MONTHLY_CAP, CAP_MESSAGE);
      }
      return true;
    }
    return false;
  }

  /**
   * shortcut: "하루 광고비가 하루 예산의 2배"를 누적 광고비로 어림한다(누적 > 하루 예산 × 지난 날 수 × 2). 하루치 광고비를
   * 따로 가져오게 되면 그 값으로 바꾼다.
   */
  static boolean overspent(double spendToDate, double dailyBudget, double elapsedHours) {
    double days = Math.max(1, Math.ceil(elapsedHours / 24));
    return dailyBudget > 0 && spendToDate > dailyBudget * days * 2;
  }

  private boolean overspent(Tournament t, TourRound r) {
    if (r.getSpendToDate() == null || r.getLaunchedAt() == null || t.getDailyBudget() == null) return false;
    double hours = Duration.between(Instant.parse(r.getLaunchedAt()), clock.instant()).toMinutes() / 60.0;
    return overspent(r.getSpendToDate(), t.getDailyBudget(), hours);
  }

  /** 대행 브랜드(고객이 있음)만 상한을 본다. 승인된 이번 달 계획이 없으면 게재 승인 단계가 이미 막는다. */
  public boolean capReached(String workspaceId, String brandId) {
    if (members.findByWorkspaceIdAndRoleAndBrandProfileIdAndRemovedAtIsNull(workspaceId, Role.CLIENT, brandId).isEmpty()) {
      return false;
    }
    YearMonth month = YearMonth.now(clock.withZone(KST));
    Optional<MonthlyPlan> plan =
        plans
            .findById(MonthlyPlanRepository.idOf(brandId, month.toString()))
            .filter(p -> workspaceId.equals(p.getOwnerKey()))
            .filter(p -> MonthlyPlan.APPROVED.equals(p.getStatus()));
    if (plan.isEmpty() || plan.get().getBudgetCap() == null) return false;
    return monthSpend(workspaceId, brandId, month) >= plan.get().getBudgetCap();
  }

  /** 이번 달에 게재한 라운드가 실제로 쓴 광고비 합. 판정이 끝난 라운드는 판정 때 성과, 진행 중은 마지막 수집값. */
  private double monthSpend(String workspaceId, String brandId, YearMonth month) {
    double sum = 0;
    for (Tournament t : repository.findByOwnerKeyAndBrandProfileIdOrderByCreatedAtDesc(workspaceId, brandId)) {
      for (TourRound r : t.getRounds()) {
        if (r.getLaunchedAt() == null || !YearMonth.from(Instant.parse(r.getLaunchedAt()).atZone(KST)).equals(month)) {
          continue;
        }
        if (r.getSpendToDate() != null) {
          sum += r.getSpendToDate();
        } else if (r.getAdKpis() != null) {
          sum += r.getAdKpis().stream().mapToDouble(k -> k.getSpend() == null ? 0 : k.getSpend()).sum();
        }
      }
    }
    return sum;
  }

  /** 실험을 멈춤으로 두고 Meta 의 캠페인을 끈다. 끄지 못해도 멈춤은 남기고 직접 꺼 달라고 알린다. */
  private void stop(String id, String reason, String message) {
    Tournament t = repository.findById(id).orElseThrow();
    TourRound r = running(t);
    String shown = message;
    try {
      setCampaignStatus(t, r, "PAUSED");
    } catch (RuntimeException e) {
      log.warn("Meta 캠페인을 끄지 못했어요: {} — {}", id, e.getMessage());
      shown = message + " Meta에서 광고를 끄지 못했어요. 광고 관리자에서 직접 꺼 주세요.";
    }
    String finalShown = shown;
    tx.executeWithoutResult(
        s -> {
          Tournament fresh = repository.findById(id).orElseThrow();
          fresh.setStopReason(reason);
          fresh.setLastError(finalShown);
          repository.save(fresh);
        });

    try {
      List<String> to = new ArrayList<>(notifications.leads(t.getOwnerKey()));
      brands.findById(t.getBrandProfileId()).map(BrandConnection::getManagerEmail).ifPresent(to::add);
      notifications.send(
          to,
          t.getOwnerKey(),
          "auto-stop",
          "'" + Notifications.name(t.getProductName()) + "' " + Notifications.reason(finalShown),
          "/ab-tests/" + id,
          "auto-stop:" + id + ":" + reason + ":" + r.getIndex());
    } catch (RuntimeException e) {
      log.warn("자동 멈춤 알림을 저장하지 못했어요: {} — {}", id, e.getMessage());
    }
  }

  /** 다시 시작할 때 캠페인을 다시 켠다. */
  void reactivate(Tournament t) {
    TourRound r = running(t);
    if (r != null) setCampaignStatus(t, r, "ACTIVE");
  }

  private void setCampaignStatus(Tournament t, TourRound r, String status) {
    if (r == null || r.getCampaignId() == null || t.getDelivery() == null) return;
    graph.post("/" + r.getCampaignId(), Map.of("status", status), t.getDelivery().getAccessToken());
  }

  private static TourRound running(Tournament t) {
    return t.getRounds().stream().filter(x -> "running".equals(x.getStatus())).findFirst().orElse(null);
  }
}
