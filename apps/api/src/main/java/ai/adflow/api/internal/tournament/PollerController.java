package ai.adflow.api.internal.tournament;

import ai.adflow.api.internal.InternalSecret;
import ai.adflow.api.tournament.TournamentPoller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 수동 트리거 (설계 §6) — 한 사이클을 즉시 돌린다.
 *
 * <p>개발 머신은 늘 켜져 있지 않아 6시간 주기만으로는 검증이 불가능하다. 로컬 편의만은 아니다 —
 * 배포하면 슬립하는 무료 플랜에서 외부 cron 이 이 엔드포인트를 때려 폴러를 기동하는 경로가 그대로 된다.
 */
@RestController
@RequestMapping("/internal/poller")
public class PollerController {

  private final TournamentPoller poller;
  private final InternalSecret internalSecret;

  public PollerController(TournamentPoller poller, InternalSecret internalSecret) {
    this.poller = poller;
    this.internalSecret = internalSecret;
  }

  @PostMapping("/run")
  public TournamentPoller.Cycle run(
      @RequestHeader(value = "X-Internal-Secret", required = false) String presented) {

    internalSecret.require(presented);
    return poller.runOnce();
  }
}
