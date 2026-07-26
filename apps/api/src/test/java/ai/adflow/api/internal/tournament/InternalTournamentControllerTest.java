package ai.adflow.api.internal.tournament;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ai.adflow.api.tournament.RoundKpiClient;
import ai.adflow.api.tournament.Tournament;
import ai.adflow.api.tournament.TourRound;
import ai.adflow.api.tournament.engine.AdKpi;
import ai.adflow.api.tournament.engine.RoundVerdict;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 결산 엔드포인트 — 단계 5 의 종착점.
 *
 * <p>Meta 조회는 역위임이라 실제 HTTP 를 태우지 않는다. RoundKpiClient 를 갈아끼워 "ad study 가 뭐라고
 * 답했는가"만 주입하고, 그 뒤 <b>Java 가 내리는 판정</b>(가설 verdict·챔피언 승격·수렴·예산)을 본다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InternalTournamentControllerTest {

  private static final String SECRET = "test-internal-secret";

  /** ad study 응답 스텁. null 이면 "아직 유의성 없음" = 결산 보류. */
  static class StubKpiClient extends RoundKpiClient {
    static RoundKpiClient.Reading next;

    StubKpiClient() {
      super("", "");
    }

    @Override
    public Reading read(Tournament t, TourRound round) {
      return next;
    }
  }

  @TestConfiguration
  static class Stubs {
    @Bean
    @Primary
    RoundKpiClient stubKpiClient() {
      return new StubKpiClient();
    }
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private tools.jackson.databind.ObjectMapper json;

  @BeforeEach
  void reset() {
    StubKpiClient.next = null;
  }

  /** 라운드 1은 파라미터로 받아 방어/승격 이력을 갈아끼운다. 라운드 2가 결산 대상(running)이다. */
  private static String tournament(String id, String round1Winner, String round1State) {
    return """
        {
          "id": "%s",
          "brandProfileId": "bp_1",
          "productId": "prod_1",
          "productName": "수분 크림",
          "tone": "warm",
          "objective": "traffic",
          "mode": "auto",
          "dailyBudget": 30000,
          "champion": {"headline": "챔피언 헤드", "primaryText": "챔피언 카피"},
          "championCtr": 1.8,
          "championConfirmed": true,
          "axisCursor": 1,
          "rounds": [
            {
              "index": 1, "axis": "headline", "campaignId": "c1",
              "champion": {"headline": "A", "primaryText": "AP"},
              "challenger": {"headline": "B", "primaryText": "AP"},
              "fastForwardDays": 0,
              "verdict": {"state": "%s", "ctrA": 2.0, "ctrB": 1.5, "confidence": 0.95},
              "rawWinner": "%s", "status": "settled"
            },
            {
              "index": 2, "axis": "primary_text", "campaignId": "c2",
              "champion": {"headline": "챔피언 헤드", "primaryText": "챔피언 카피"},
              "challenger": {"headline": "챌린저 헤드", "primaryText": "챌린저 카피"},
              "fastForwardDays": 0, "status": "running", "studyId": "study_2",
              "hypothesis": {
                "id": "hyp_r2", "lever": "benefit", "statement": "혜택을 먼저 말하면 CTR이 오른다",
                "predictedMetric": "CTR", "predictedDirection": "up", "rationale": "근거",
                "rationaleSource": "ledger",
                "contextTags": {"productId": "prod_1", "objective": "traffic"},
                "status": "testing"
              }
            }
          ],
          "spentBudget": 120000,
          "status": "running",
          "createdAt": "2026-07-01T00:00:00Z"
        }
        """
        .formatted(id, round1State, round1Winner);
  }

  private void seed(String owner, String json) throws Exception {
    mockMvc
        .perform(
            post("/internal/tournaments")
                .header("X-Internal-Secret", SECRET)
                .param("ownerKey", owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + json + "}"))
        .andExpect(status().isOk());
  }

  private static RoundKpiClient.Reading reading(String state, double ctrA, double ctrB, String winner) {
    return new RoundKpiClient.Reading(
        List.of(new AdKpi(15000, 270, ctrA, 91911), new AdKpi(15000, 360, ctrB, 91911)),
        new RoundVerdict(state, ctrA, ctrB, 0.97),
        winner);
  }

  @Test
  void 시크릿이_없으면_401() throws Exception {
    mockMvc.perform(post("/internal/tournaments/x/settle")).andExpect(status().isUnauthorized());
  }

  /**
   * 역위임의 유일한 미검증 이음매 — Next 라우트가 뱉는 JSON 을 Spring 이 읽을 수 있는가.
   *
   * <p>양쪽 테스트가 각자만 보면 필드 이름이 어긋나도 둘 다 green 이다. 여기 문자열은 round-kpis
   * 라우트가 실제로 만드는 모양(kpis·verdict·winner)이다.
   */
  @Test
  void Next_가_돌려주는_KPI_응답을_그대로_읽는다() throws Exception {
    String fromNext =
        """
        {"kpis":[{"ctr":1.8,"impressions":15000,"clicks":270,"spend":91911},
                 {"ctr":2.4,"impressions":15000,"clicks":360,"spend":91911}],
         "verdict":{"state":"winner","ctrA":1.8,"ctrB":2.4,"confidence":0.97},
         "winner":"B"}
        """;

    RoundKpiClient.Reading r = json.readValue(fromNext, RoundKpiClient.Reading.class);
    org.junit.jupiter.api.Assertions.assertEquals(2, r.kpis().size());
    org.junit.jupiter.api.Assertions.assertEquals(360, r.kpis().get(1).clicks());
    org.junit.jupiter.api.Assertions.assertEquals("winner", r.verdict().state());
    org.junit.jupiter.api.Assertions.assertEquals(2.4, r.verdict().ctrB());
    org.junit.jupiter.api.Assertions.assertEquals("B", r.winner());

    // 스터디 진행 중 — 결산 보류로 읽혀야 한다.
    RoundKpiClient.Reading pending =
        json.readValue("{\"kpis\":[],\"verdict\":null,\"winner\":null}", RoundKpiClient.Reading.class);
    org.junit.jupiter.api.Assertions.assertNull(pending.verdict());
  }

  @Test
  void 없는_토너먼트는_no_active() throws Exception {
    mockMvc
        .perform(post("/internal/tournaments/nope/settle").header("X-Internal-Secret", SECRET))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("no-active"));
  }

  @Test
  void 스터디가_유의성을_못_내면_결산을_보류한다() throws Exception {
    seed("a@example.com", tournament("t_pending", "B", "winner"));
    StubKpiClient.next = new RoundKpiClient.Reading(List.of(), null, null);

    mockMvc
        .perform(post("/internal/tournaments/t_pending/settle").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.status").value("insufficient"));

    // 라운드가 그대로 running 이어야 다음 폴이 재시도한다.
    mockMvc
        .perform(get("/internal/tournaments/t_pending").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.rounds[1].status").value("running"))
        .andExpect(jsonPath("$.rounds[1].verdict").doesNotExist());
  }

  @Test
  void 챌린저가_이기면_챔피언이_승격되고_가설이_입증된다() throws Exception {
    seed("a@example.com", tournament("t_promote", "B", "winner"));
    StubKpiClient.next = reading("winner", 1.8, 2.4, "B");

    mockMvc
        .perform(post("/internal/tournaments/t_promote/settle").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.status").value("settled"))
        .andExpect(jsonPath("$.winnerIsB").value(true))
        .andExpect(jsonPath("$.badge").value("winner"))
        .andExpect(jsonPath("$.completed").value(false));

    mockMvc
        .perform(get("/internal/tournaments/t_promote").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.champion.headline").value("챌린저 헤드"))
        .andExpect(jsonPath("$.championCtr").value(2.4))
        .andExpect(jsonPath("$.axisCursor").value(2))
        // MIN_ROUND_DAYS(4) × dailyBudget(30000) 만큼 봉투를 깎는다.
        .andExpect(jsonPath("$.spentBudget").value(240000))
        .andExpect(jsonPath("$.status").value("running"))
        .andExpect(jsonPath("$.rounds[1].status").value("settled"))
        .andExpect(jsonPath("$.rounds[1].rawWinner").value("B"))
        .andExpect(jsonPath("$.rounds[1].adKpis[1].clicks").value(360))
        .andExpect(jsonPath("$.rounds[1].hypothesis.status").value("resolved"))
        .andExpect(jsonPath("$.rounds[1].hypothesis.verdict").value("confirmed"))
        // (2.4 - 1.8) / 1.8 × 100 = 33.3% — traffic 은 높을수록 개선이라 부호 그대로.
        .andExpect(jsonPath("$.rounds[1].hypothesis.effectSize").value(33.3))
        .andExpect(jsonPath("$.rounds[1].hypothesis.resolvedAt").exists());
  }

  @Test
  void 챔피언이_유의하게_방어하면_가설이_반증된다() throws Exception {
    seed("a@example.com", tournament("t_defend", "B", "winner"));
    StubKpiClient.next = reading("winner", 2.4, 1.8, "A");

    mockMvc
        .perform(post("/internal/tournaments/t_defend/settle").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.winnerIsB").value(false));

    mockMvc
        .perform(get("/internal/tournaments/t_defend").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.champion.headline").value("챔피언 헤드"))
        .andExpect(jsonPath("$.rounds[1].hypothesis.verdict").value("refuted"));
  }

  @Test
  void 챔피언_2연속_방어면_수렴으로_자동_완료된다() throws Exception {
    // ADR-061 — DEFAULT_DEFEND_STREAK = 2. 라운드 1이 이미 A 방어라 이번 방어로 채워진다.
    seed("a@example.com", tournament("t_converge", "A", "winner"));
    StubKpiClient.next = reading("winner", 2.4, 1.8, "A");

    mockMvc
        .perform(post("/internal/tournaments/t_converge/settle").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.status").value("settled"))
        .andExpect(jsonPath("$.completed").value(true));

    mockMvc
        .perform(get("/internal/tournaments/t_converge").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.status").value("completed"))
        .andExpect(jsonPath("$.completionReason").value("converged"));
  }

  @Test
  void 판정이_갈리지_않으면_챔피언이_남고_가설은_미결이다() throws Exception {
    seed("a@example.com", tournament("t_incon", "B", "winner"));
    StubKpiClient.next = reading("inconclusive", 2.0, 2.05, "A");

    mockMvc
        .perform(post("/internal/tournaments/t_incon/settle").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.badge").value("inconclusive"));

    mockMvc
        .perform(get("/internal/tournaments/t_incon").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.champion.headline").value("챔피언 헤드"))
        .andExpect(jsonPath("$.rounds[1].hypothesis.verdict").value("inconclusive"));
  }

  @Test
  void 진행_중인_라운드가_없으면_no_active() throws Exception {
    seed("a@example.com", tournament("t_done", "B", "winner"));
    StubKpiClient.next = reading("winner", 1.8, 2.4, "B");
    mockMvc
        .perform(post("/internal/tournaments/t_done/settle").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.status").value("settled"));

    mockMvc
        .perform(post("/internal/tournaments/t_done/settle").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.status").value("no-active"));
  }

  @Test
  void 목록은_status_ownerKey_brandProfileId_로_좁혀진다() throws Exception {
    seed("owner1@example.com", tournament("t_l1", "B", "winner"));
    seed("owner2@example.com", tournament("t_l2", "B", "winner"));

    // cron 전역 스캔 — 소유자를 가리지 않는다.
    mockMvc
        .perform(get("/internal/tournaments").header("X-Internal-Secret", SECRET).param("status", "running"))
        .andExpect(jsonPath("$.items.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)));

    mockMvc
        .perform(
            get("/internal/tournaments")
                .header("X-Internal-Secret", SECRET)
                .param("ownerKey", "owner1@example.com"))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].id").value("t_l1"));

    mockMvc
        .perform(
            get("/internal/tournaments")
                .header("X-Internal-Secret", SECRET)
                .param("ownerKey", "owner1@example.com")
                .param("brandProfileId", "bp_none"))
        .andExpect(jsonPath("$.items.length()").value(0));
  }
}
