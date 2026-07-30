package ai.adflow.api.internal.tournament;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 수동 트리거는 배포하면 외부 cron 이 때리는 공개 경로가 된다 — 잠금이 풀리면 아무나 폴러를 돌린다.
 * 나머지 내부 컨트롤러엔 있던 401 잠금 테스트가 여기만 없었다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PollerControllerTest {

  /** application-test.yml 의 app.internal-secret. */
  private static final String SECRET = "test-internal-secret";

  @Autowired private MockMvc mockMvc;

  @Test
  void 시크릿이_없으면_401() throws Exception {
    mockMvc.perform(post("/internal/poller/run")).andExpect(status().isUnauthorized());
  }

  @Test
  void 시크릿이_틀리면_401() throws Exception {
    mockMvc
        .perform(post("/internal/poller/run").header("X-Internal-Secret", "wrong"))
        .andExpect(status().isUnauthorized());
  }

  /**
   * 돌 토너먼트가 없어도 한 바퀴는 돌아야 한다. 그리고 그 사실이 cron_runs 에 남아야 한다 — 안 남으면
   * health 의 dead-man's switch(ADR-042)가 "폴러가 죽었다"고 오탐한다.
   */
  @Test
  void 시크릿이_맞으면_한_바퀴_돌고_자기기록을_남긴다() throws Exception {
    mockMvc
        .perform(post("/internal/poller/run").header("X-Internal-Secret", SECRET))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.scanned").value(0))
        .andExpect(jsonPath("$.errors").isEmpty());

    mockMvc
        .perform(
            get("/internal/cron-runs/last-success")
                .param("job", "tournament-poller")
                .header("X-Internal-Secret", SECRET))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ok").value(true));
  }
}
