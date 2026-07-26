package ai.adflow.api.tournament;

import ai.adflow.api.internal.cron.CronRun;
import ai.adflow.api.internal.cron.CronRunRepository;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 무인 폴러 (ADR-038 결정 3) — 브라우저도 세션도 없이 실유저 토너먼트를 진행한다. 단계 6 에서 Next 의
 * cron 라우트를 흡수했다.
 *
 * <p>토너먼트마다 ① Java 엔진으로 결산 시도(스터디 미확정이면 보류) ② 결산 여부와 무관하게 auto 무인
 * 체인으로 다음 라운드 게재 ③ 결산됐으면 SSE 알림. ②를 항상 도는 이유는 1라운드 부트스트랩도 여기서
 * 일어나기 때문이다.
 *
 * <p>주기는 {@code app.poller.interval} 이다 — 운영 6시간, 로컬 프로필 1분(설계 §6). 개발 머신은 늘
 * 켜져 있지 않아 주기만으로는 검증이 안 되므로 수동 트리거(POST /internal/poller/run)를 함께 둔다.
 */
@Component
public class TournamentPoller {

  private static final Logger log = LoggerFactory.getLogger(TournamentPoller.class);

  /** 한 사이클 결과. Next 의 cron-runs 기록과 같은 집계다. */
  public record Cycle(int scanned, int settled, int advanced, List<String> errors) {}

  /** ADR-042 — health 라우트의 dead-man's switch 가 이 이름으로 마지막 성공을 찾는다. */
  private static final String JOB = "tournament-poller";

  private final TournamentRepository repository;
  private final TournamentSettleService settleService;
  private final TournamentAdvanceService advanceService;
  private final TournamentNotifier notifier;
  private final CronRunRepository cronRuns;
  private final Clock clock;

  public TournamentPoller(
      TournamentRepository repository,
      TournamentSettleService settleService,
      TournamentAdvanceService advanceService,
      TournamentNotifier notifier,
      CronRunRepository cronRuns,
      Clock clock) {
    this.repository = repository;
    this.settleService = settleService;
    this.advanceService = advanceService;
    this.notifier = notifier;
    this.cronRuns = cronRuns;
    this.clock = clock;
  }

  @Scheduled(fixedDelayString = "${app.poller.interval}")
  public void scheduled() {
    Cycle c = runOnce();
    if (c.scanned() > 0 || !c.errors().isEmpty()) {
      log.info("폴러 한 바퀴 — 스캔 {} · 결산 {} · 진행 {} · 오류 {}",
          c.scanned(), c.settled(), c.advanced(), c.errors().size());
    }
  }

  public Cycle runOnce() {
    String startedAt = clock.instant().toString();
    int settled = 0;
    int advanced = 0;
    List<String> errors = new ArrayList<>();

    // ADR-053 — 게재 실패(lastError)로 멈춘 토너먼트는 자동 진행 대상에서 뺀다. 상세 배너가 사람에게 알린다.
    List<Tournament> active = new ArrayList<>();
    for (Tournament t : repository.findByStatusOrderByCreatedAtDesc("running")) {
      if (t.getDelivery() != null && t.getLastError() == null) active.add(t);
    }

    for (Tournament t : active) {
      try {
        TournamentSettleService.Outcome outcome = settleService.settle(t.getId());
        if ("settled".equals(outcome.status())) settled += 1;

        // 러닝·미확정 챔피언·봉투 브레이크는 autoAdvance 가 가드하므로 매 틱 불러도 안전하다.
        // 결산이 안 됐어도 굴려 1라운드를 띄운다.
        if (advanceService.autoAdvance(t.getId())) advanced += 1;

        if (!"settled".equals(outcome.status())) continue;

        // 알림은 최신 상태로 — autoAdvance 가 status 를 바꿨을 수 있다.
        Tournament fresh = repository.findById(t.getId()).orElse(null);
        if (fresh != null) notifier.roundConcluded(fresh, outcome);
      } catch (RuntimeException e) {
        errors.add(t.getId() + ": " + e.getMessage());
      }
    }

    record(startedAt, active.size(), settled, advanced, errors);
    return new Cycle(active.size(), settled, advanced, errors);
  }

  /**
   * ADR-042 관측성 1겹 — 폴러 자기기록. 단계 6 전에는 Next cron 이 /internal/cron-runs 로 남겼다.
   * 폴러가 Spring 으로 옮겨왔으니 기록도 여기서 한다 — 안 남기면 health 의 dead-man's switch 가
   * "폴러가 죽었다"고 오탐한다.
   */
  private void record(String startedAt, int scanned, int settled, int advanced, List<String> errors) {
    CronRun run = new CronRun();
    run.setJob(JOB);
    run.setOk(errors.isEmpty());
    run.setScanned(scanned);
    run.setSettled(settled);
    run.setAdvanced(advanced);
    run.setErrors(errors);
    run.setStartedAt(startedAt);
    run.setFinishedAt(clock.instant().toString());
    cronRuns.save(run);
  }
}
