package ai.adflow.api.internal.tournament;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 사람이 누르는 편집이 Spring 으로 넘어왔는지.
 *
 * <p>전에는 Next 가 애그리거트를 통째로 upsert 했다 — 지우고 새로 넣으므로 {@code @Version} 비교를
 * 지나가서, 폴러 틱과 겹치면 앞선 변경이 조용히 사라졌다. 이제 필요한 필드만 고친다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TournamentEditTest {

  private static final String SECRET = "test-internal-secret";

  @Autowired private MockMvc mockMvc;

  private static String tournament(String id) {
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
          "axisCursor": 0,
          "rounds": [],
          "spentBudget": 120000,
          "status": "running",
          "createdAt": "2026-07-01T00:00:00Z",
          "delivery": {
            "accessToken": "tok", "adAccountId": "act_1", "pageId": "page_1",
            "ownerEmail": "u@x.com"
          }
        }
        """
        .formatted(id);
  }

  private void seed(String id) throws Exception {
    mockMvc
        .perform(
            post("/internal/tournaments")
                .header("X-Internal-Secret", SECRET)
                .param("ownerKey", "u@x.com")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + tournament(id) + "}"))
        .andExpect(status().isOk());
  }

  private org.springframework.test.web.servlet.ResultActions edit(String id, String action, String body)
      throws Exception {
    var req =
        post("/internal/tournaments/" + id + "/edit")
            .header("X-Internal-Secret", SECRET)
            .param("action", action)
            .contentType(MediaType.APPLICATION_JSON);
    return mockMvc.perform(body == null ? req.content("{}") : req.content(body));
  }

  @Test
  void 시크릿이_없으면_401() throws Exception {
    mockMvc
        .perform(post("/internal/tournaments/x/edit").param("action", "resume").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 없는_토너먼트는_404() throws Exception {
    edit("nope", "resume", null).andExpect(status().isNotFound());
  }

  @Test
  void 모르는_액션은_400() throws Exception {
    seed("t_unknown");
    edit("t_unknown", "무엇", null).andExpect(status().isBadRequest());
  }

  @Test
  void 챔피언을_편집본으로_확정한다() throws Exception {
    seed("t_confirm");

    edit("t_confirm", "confirm-champion", "{\"variant\":{\"headline\":\"손본 헤드\",\"primaryText\":\"손본 카피\"}}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.championConfirmed").value(true))
        .andExpect(jsonPath("$.champion.headline").value("손본 헤드"));
  }

  @Test
  void 편집본이_없으면_카피는_그대로_두고_확정만_한다() throws Exception {
    seed("t_confirm_plain");

    edit("t_confirm_plain", "confirm-champion", null)
        .andExpect(jsonPath("$.championConfirmed").value(true))
        .andExpect(jsonPath("$.champion.headline").value("챔피언 헤드"));
  }

  @Test
  void 확정된_챔피언은_다시_뽑을_수_없다() throws Exception {
    // 재생성은 부트스트랩 검토 단계의 문이다. 확정 뒤에 열어두면 라운드 이력과 어긋난다.
    seed("t_replace");
    edit("t_replace", "confirm-champion", null).andExpect(status().isOk());

    edit("t_replace", "replace-champion", "{\"variant\":{\"headline\":\"새 헤드\",\"primaryText\":\"새 카피\"}}")
        .andExpect(status().isConflict());
  }

  @Test
  void 수동_챌린저를_pending_으로_넣는다() throws Exception {
    seed("t_challenger");

    edit("t_challenger", "set-challenger", "{\"variant\":{\"headline\":\"수동 헤드\",\"primaryText\":\"수동 카피\"}}")
        .andExpect(jsonPath("$.pendingChallenger.headline").value("수동 헤드"));
  }

  @Test
  void 봉투가_없으면_지금까지_쓴_금액_위에_얹는다() throws Exception {
    // spentBudget=120000 인 토너먼트에 300000 을 더한다.
    seed("t_refill_new");

    edit("t_refill_new", "refill-envelope", "{\"addBudget\":300000}")
        .andExpect(jsonPath("$.envelope.totalBudget").value(420000.0));
  }

  @Test
  void 충전액을_안_주면_기본값_30만원() throws Exception {
    seed("t_refill_default");
    edit("t_refill_default", "refill-envelope", null)
        .andExpect(jsonPath("$.envelope.totalBudget").value(420000.0));
  }

  @Test
  void resume_은_lastError_를_지운다() throws Exception {
    seed("t_resume");
    // upsert 로 lastError 를 심는다(생성 경로라 이 테스트에서는 문제 없다).
    mockMvc
        .perform(
            post("/internal/tournaments")
                .header("X-Internal-Secret", SECRET)
                .param("ownerKey", "u@x.com")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"item\":"
                        + tournament("t_resume").replace("\"status\": \"running\"", "\"status\": \"running\", \"lastError\": \"게재 실패\"")
                        + "}"))
        .andExpect(status().isOk());

    edit("t_resume", "resume", null).andExpect(status().isOk());

    mockMvc
        .perform(get("/internal/tournaments/t_resume").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.lastError").doesNotExist());
  }

  @Test
  void 종료는_완료_사유를_엔진이_정한다() throws Exception {
    // ADR-061 — autoRefill 이 없으면 예산소진.
    seed("t_end");

    edit("t_end", "end", null)
        .andExpect(jsonPath("$.status").value("completed"))
        .andExpect(jsonPath("$.completionReason").value("budget-exhausted"))
        .andExpect(jsonPath("$.pendingChallenger").doesNotExist());
  }

  @Test
  void 편집은_버전을_올린다() throws Exception {
    // 버전이 안 오르면 낙관적 락이 아무것도 못 막는다. version 은 와이어에 안 나가므로 편집이
    // 연달아 성공하는지로 확인한다 — 두 번째가 stale 버전으로 터지면 여기서 드러난다.
    seed("t_version");
    edit("t_version", "confirm-champion", null).andExpect(status().isOk());
    edit("t_version", "refill-envelope", "{\"addBudget\":100000}").andExpect(status().isOk());
    edit("t_version", "resume", null).andExpect(status().isOk());

    mockMvc
        .perform(get("/internal/tournaments/t_version").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.championConfirmed").value(true))
        .andExpect(jsonPath("$.envelope.totalBudget").value(220000.0))
        // 서버 전용 필드가 새면 TS 타입과 어긋난다.
        .andExpect(jsonPath("$.version").doesNotExist());
  }
}
