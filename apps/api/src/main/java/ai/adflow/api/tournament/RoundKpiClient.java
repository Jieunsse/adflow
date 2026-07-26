package ai.adflow.api.tournament;

import ai.adflow.api.tournament.engine.AdKpi;
import ai.adflow.api.tournament.engine.RoundVerdict;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * 역위임 (설계 §9) — Meta insights·ad study 조회는 아직 TS 에 있다. 단계 5 의 Spring 은 판정만
 * 소유하고 KPI 는 Next 내부 라우트에 되묻는다. 단계 6 에서 Meta 클라이언트를 Java 로 옮기면 이
 * 클래스가 통째로 사라진다.
 *
 * <p>토너먼트·라운드를 <b>요청 바디에 실어 보낸다.</b> Next 가 조회하러 Spring 을 되부르면 순환이 되고,
 * 그 사이 행이 바뀌면 판정과 KPI 가 다른 스냅샷을 보게 된다.
 */
@Component
public class RoundKpiClient {

  /**
   * verdict 이 null 이면 ad study 가 아직 유의성을 못 냈다는 뜻이다 — 결산을 보류하고 다음 폴에
   * 재시도한다(TS pollAndSettle 과 같은 규칙, ADR §4).
   */
  public record Reading(List<AdKpi> kpis, RoundVerdict verdict, String winner) {}

  private final RestClient http;
  private final String baseUrl;
  private final String secret;

  public RoundKpiClient(
      @Value("${app.next-internal-url:}") String baseUrl,
      @Value("${app.internal-secret}") String secret) {
    this.baseUrl = baseUrl == null ? "" : baseUrl.replaceAll("/+$", "");
    this.secret = secret;
    this.http = RestClient.create();
  }

  public Reading read(Tournament t, TourRound round) {
    if (baseUrl.isEmpty()) {
      throw new IllegalStateException("app.next-internal-url 이 없어 KPI 를 조회할 수 없어요.");
    }
    return http
        .post()
        .uri(baseUrl + "/api/internal/tournament/round-kpis")
        .header("X-Internal-Secret", secret)
        .contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("tournament", t, "round", round))
        .retrieve()
        .body(Reading.class);
  }
}
