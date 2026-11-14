package ai.adflow.api.tournament;

import ai.adflow.api.brand.BrandConnection;
import ai.adflow.api.brand.BrandConnectionRepository;
import ai.adflow.api.notification.Notifications;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import ai.adflow.api.security.Role;
import ai.adflow.api.workspace.Member;
import java.time.Clock;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * 게재 요청과 승인 (기능 7, 정책서 11.1·11.2). 승인 없이는 Meta 에 올리지 않는다.
 *
 * <p>shortcut: 월간 계획 예산 상한(11.4)·브랜드 규칙 검사·광고 계정 상태 검사는 아직 하지 않는다. 월간
 * 계획(기능 12)을 만들 때 approve 에 상한 검사를 넣는다.
 */
@Service
public class LaunchApprovalService {

  private static final Logger log = LoggerFactory.getLogger(LaunchApprovalService.class);

  static final String PENDING = "pending";
  static final String LAUNCHING = "launching";
  static final String FAILED = "failed";
  static final String REJECTED = "rejected";

  private static final double MIN_DAILY_BUDGET = 10_000;
  private static final int MIN_REJECT_REASON = 10;

  private final TournamentRepository repository;
  private final TournamentAdvanceService advance;
  private final BrandConnectionRepository brands;
  private final TransactionTemplate tx;
  private final Clock clock;
  private final Notifications notifications;

  public LaunchApprovalService(
      TournamentRepository repository,
      TournamentAdvanceService advance,
      BrandConnectionRepository brands,
      TransactionTemplate tx,
      Clock clock,
      Notifications notifications) {
    this.repository = repository;
    this.advance = advance;
    this.brands = brands;
    this.tx = tx;
    this.clock = clock;
    this.notifications = notifications;
  }

  /** 알림은 본래 일이 끝난 뒤 따로 보낸다. 알림이 실패해도 승인·게재를 되돌리지 않는다. */
  private void notifySafely(Runnable send) {
    try {
      tx.executeWithoutResult(s -> send.run());
    } catch (RuntimeException e) {
      log.warn("알림을 저장하지 못했어요: {}", e.getMessage());
    }
  }

  private static String link(String id) {
    return "/ab-tests/" + id;
  }

  /** 직원 누구나 요청한다. 게재 전 검사 중 처음 걸린 하나만 알려 준다 (11.1). */
  public Tournament request(Member me, String id) {
    Tournament saved = requestInTx(me, id);
    notifySafely(
        () ->
            notifications.send(
                notifications.approvers(me.getWorkspaceId()),
                me.getWorkspaceId(),
                "launch-request",
                "'" + Notifications.name(saved.getProductName()) + "' 다음 실험이 게재 승인을 기다려요.",
                link(id),
                "launch-request:" + id + ":" + saved.getLaunchRequest().getRequestedAt()));
    return saved;
  }

  private Tournament requestInTx(Member me, String id) {
    return tx.execute(
        s -> {
          Tournament t = load(me, id);
          String status = statusOf(t);
          if (PENDING.equals(status) || LAUNCHING.equals(status)) {
            throw bad("요청을 보내는 중이에요.");
          }
          if (t.getRounds().stream().anyMatch(r -> "running".equals(r.getStatus()))) {
            throw bad("이미 진행 중인 실험이 있어요. 판정이 끝난 뒤에 요청해 주세요.");
          }
          BrandConnection c = brands.findById(t.getBrandProfileId()).orElse(null);
          if (c == null || c.getAdAccountId() == null || c.getPageId() == null) {
            throw bad("광고 계정과 페이지가 연결되지 않았어요. 계정 연결에서 연결해 주세요.");
          }
          if (t.getPendingChallenger() == null) throw bad("소재가 아직 다 만들어지지 않았어요.");
          TournamentDelivery d = t.getDelivery();
          if (d == null || d.getLinkUrl() == null || !d.getLinkUrl().startsWith("https://")) {
            throw bad("도착 주소는 https://로 시작해야 해요.");
          }
          if (d.getCountries() == null || d.getCountries().isEmpty()) {
            throw bad("광고를 보여 줄 나라를 하나 이상 골라 주세요.");
          }
          if (t.getDailyBudget() == null || t.getDailyBudget() < MIN_DAILY_BUDGET) {
            throw bad("하루 예산은 1만 원 이상이어야 해요.");
          }

          Tournament.LaunchRequest r = new Tournament.LaunchRequest();
          r.setStatus(PENDING);
          r.setRequestedBy(me.getEmail());
          r.setRequestedAt(clock.instant().toString());
          t.setLaunchRequest(r);
          return repository.save(t);
        });
  }

  /**
   * 승인하면 바로 Meta 에 올린다. 승인 뒤 전송이 실패한 요청(failed)은 같은 경로로 다시 시도한다 — 승인을
   * 다시 받지 않는다 (11.2).
   */
  public Tournament approve(Member me, String id) {
    Tournament before =
        tx.execute(
            s -> {
              Tournament t = load(me, id);
              requireApprover(me, t);
              if (repository.moveLaunchStatus(id, List.of(PENDING, FAILED), LAUNCHING) == 0) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 처리된 요청이에요. 화면을 새로 고쳐 주세요.");
              }
              return t;
            });
    String requester = before.getLaunchRequest() == null ? null : before.getLaunchRequest().getRequestedBy();
    String name = Notifications.name(before.getProductName());

    try {
      Tournament launched = tx.execute(
          s -> {
            Tournament t = repository.findById(id).orElseThrow();
            // 승인 시점의 브랜드 연결로 올린다. 실험을 만든 뒤 브랜드의 광고 계정이 바뀌었을 수 있다.
            BrandConnection c = brands.findById(t.getBrandProfileId()).orElse(null);
            if (c == null || c.getAdAccountId() == null || c.getPageId() == null) {
              throw new IllegalStateException("광고 계정과 페이지가 연결되지 않았어요. 계정 연결에서 연결해 주세요.");
            }
            t.getDelivery().setAdAccountId(c.getAdAccountId());
            t.getDelivery().setPageId(c.getPageId());
            Tournament.LaunchRequest decided = t.getLaunchRequest();
            decided.setDecidedBy(me.getEmail());
            decided.setDecidedAt(clock.instant().toString());
            advance.launch(t); // 성공하면 초안과 함께 요청도 사라진다
            t.setLastError(null);
            return repository.save(t);
          });
      notifySafely(
          () ->
              notifications.send(
                  List.of(requester == null ? "" : requester),
                  me.getWorkspaceId(),
                  "launch-approved",
                  "'" + name + "' 게재를 승인했어요. Meta 검토가 끝나면 광고가 나가요.",
                  link(id),
                  "launch-approved:" + id + ":" + launched.getRounds().size()));
      return launched;
    } catch (RuntimeException e) {
      // 실험은 멈춤이 되고 이유를 남긴다. 다시 시도는 승인 없이 한다 (11.2).
      tx.executeWithoutResult(
          s -> {
            Tournament t = repository.findById(id).orElseThrow();
            t.getLaunchRequest().setStatus(FAILED);
            t.setLastError(e.getMessage());
            repository.save(t);
          });
      List<String> to = new java.util.ArrayList<>(notifications.leads(me.getWorkspaceId()));
      if (requester != null) to.add(requester);
      notifySafely(
          () ->
              notifications.send(
                  to,
                  me.getWorkspaceId(),
                  "launch-failed",
                  "'" + name + "' Meta에 올리지 못했어요. " + Notifications.reason(e.getMessage()),
                  link(id),
                  "launch-failed:" + id + ":" + clock.instant()));
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
    }
  }

  public Tournament reject(Member me, String id, String reason) {
    Tournament saved = rejectInTx(me, id, reason);
    notifySafely(
        () ->
            notifications.send(
                List.of(saved.getLaunchRequest().getRequestedBy()),
                me.getWorkspaceId(),
                "launch-rejected",
                "'" + Notifications.name(saved.getProductName()) + "' 게재 요청이 반려됐어요. "
                    + Notifications.reason(saved.getLaunchRequest().getRejectReason()),
                link(id),
                "launch-rejected:" + id + ":" + saved.getLaunchRequest().getDecidedAt()));
    return saved;
  }

  private Tournament rejectInTx(Member me, String id, String reason) {
    return tx.execute(
        s -> {
          Tournament t = load(me, id);
          requireApprover(me, t);
          if (reason == null || reason.trim().length() < MIN_REJECT_REASON) {
            throw bad("반려 이유를 10자 이상 적어 주세요.");
          }
          if (!PENDING.equals(statusOf(t))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "승인 대기 중인 요청이 아니에요.");
          }
          Tournament.LaunchRequest r = t.getLaunchRequest();
          r.setStatus(REJECTED);
          r.setDecidedBy(me.getEmail());
          r.setDecidedAt(clock.instant().toString());
          r.setRejectReason(reason.trim());
          return repository.save(t);
        });
  }

  /** 승인은 팀장, 그리고 그 브랜드의 담당 직원 중 팀원·게재 (정책서 5.1·5.2). */
  private void requireApprover(Member me, Tournament t) {
    if (me.getRole() == Role.LEAD) return;
    String manager = brands.findById(t.getBrandProfileId()).map(BrandConnection::getManagerEmail).orElse(null);
    if (me.getRole() == Role.MEMBER_PUBLISH && me.getEmail().equals(manager)) return;
    throw new ResponseStatusException(
        HttpStatus.FORBIDDEN, "이 브랜드의 담당 직원과 팀장만 승인할 수 있어요. 팀장에게 요청해 주세요.");
  }

  private Tournament load(Member me, String id) {
    return repository
        .findById(id)
        .filter(t -> me.getWorkspaceId().equals(t.getOwnerKey()))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "실험을 찾지 못했어요."));
  }

  private static String statusOf(Tournament t) {
    return t.getLaunchRequest() == null ? null : t.getLaunchRequest().getStatus();
  }

  private static ResponseStatusException bad(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }
}
