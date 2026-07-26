package ai.adflow.api.tournament;

import ai.adflow.api.internal.NextInternalClient;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 라운드 결산 알림을 Next 로 넘긴다 (설계 §6 의 SSE 다리).
 *
 * <p>열린 SSE 커넥션은 Next 프로세스 <b>메모리</b>의 Map 에 있다 — Spring 은 다른 프로세스라 닿을 수
 * 없다. 그래서 다리가 필수다.
 *
 * <p><b>설계 §6 과 다르게 간 곳</b> — 설계는 "토큰 대신 ownerKey 를 넘겨 Next 가 해석하게" 하자고 했다.
 * 그런데 registry 키는 <b>액세스 토큰의 해시</b>이고 ownerKey 는 이메일일 수도 있다(ownerKeyFrom) —
 * 이메일에서는 키를 역산할 수 없다. 그렇다고 Next 가 토너먼트를 Spring 에 되물으면 토큰은 어차피 같은
 * 경계를 넘는다. 게다가 저장 경로(backend-store 의 upsert)가 이미 이 봉투를 통째로 실어 보낸다 —
 * 지킬 것이 남아 있지 않은 규칙이라 토큰을 그대로 넘긴다.
 *
 * <p>문구는 Next 가 만든다. 하우스 보이스(해요체)는 화면 쪽 규칙이라 서버가 한국어를 조립하지 않는다.
 *
 * <p>알림 실패는 삼킨다. 연결이 없으면 원래 no-op 이고, 알림 때문에 결산을 되돌릴 이유가 없다.
 */
@Component
public class TournamentNotifier {

  private static final Logger log = LoggerFactory.getLogger(TournamentNotifier.class);

  private final NextInternalClient next;

  public TournamentNotifier(NextInternalClient next) {
    this.next = next;
  }

  public void roundConcluded(Tournament t, TournamentSettleService.Outcome outcome) {
    if (!next.configured() || t.getDelivery() == null) return;

    TourRound round = outcome.round();
    Map<String, Object> body = new HashMap<>();
    body.put("ownerToken", t.getDelivery().getAccessToken());
    body.put("tournamentId", t.getId());
    body.put("productName", t.getProductName());
    body.put("roundIndex", round.getIndex());
    body.put("winnerIsB", outcome.winnerIsB());
    body.put("completed", outcome.completed());
    body.put("launchedAt", round.getLaunchedAt() == null ? "" : round.getLaunchedAt());

    try {
      next.post("/api/internal/notify/tournament-concluded", body);
    } catch (RuntimeException e) {
      log.warn("결산 알림 전달 실패 (무시): {} — {}", t.getId(), e.getMessage());
    }
  }
}
