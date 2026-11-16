package ai.adflow.api.internal.cron;

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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CronRunControllerTest {

  /** application-test.yml 의 app.internal-secret. */
  private static final String SECRET = "test-internal-secret";

  @Autowired private MockMvc mockMvc;

  private void record(String job, boolean ok, String startedAt) throws Exception {
    mockMvc
        .perform(
            post("/internal/cron-runs")
                .header("X-Internal-Secret", SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"job":"%s","ok":%s,"scanned":3,"settled":1,"advanced":2,
                     "errors":["부분 실패"],"started_at":"%s"}
                    """
                        .formatted(job, ok, startedAt)))
        .andExpect(status().isOk());
  }

  @Test
  void 시크릿이_없으면_401() throws Exception {
    mockMvc
        .perform(get("/internal/cron-runs/last-success").param("job", "tournament-poller"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 시크릿이_틀리면_401() throws Exception {
    mockMvc
        .perform(
            get("/internal/cron-runs/last-success")
                .param("job", "tournament-poller")
                .header("X-Internal-Secret", "wrong"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 기록이_없으면_204() throws Exception {
    mockMvc
        .perform(
            get("/internal/cron-runs/last-success")
                .param("job", "empty-job")
                .header("X-Internal-Secret", SECRET))
        .andExpect(status().isNoContent());
  }

  @Test
  void 마지막_성공만_돌려준다() throws Exception {
    record("j1", true, "2026-07-01T00:00:00Z");
    record("j1", false, "2026-07-02T00:00:00Z"); // 실패는 dead-man's switch 판정 대상이 아니다
    record("j1", true, "2026-07-03T00:00:00Z");

    mockMvc
        .perform(
            get("/internal/cron-runs/last-success").param("job", "j1").header("X-Internal-Secret", SECRET))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ok").value(true))
        .andExpect(jsonPath("$.job").value("j1"))
        // 와이어는 snake_case 다 — TS CronRun 과 health 라우트가 그 이름으로 읽는다.
        .andExpect(jsonPath("$.started_at").value("2026-07-03T00:00:00Z"))
        .andExpect(jsonPath("$.finished_at").exists())
        .andExpect(jsonPath("$.error_count").value(1))
        .andExpect(jsonPath("$.errors[0]").value("부분 실패"))
        .andExpect(jsonPath("$.scanned").value(3))
        .andExpect(jsonPath("$.settled").value(1))
        .andExpect(jsonPath("$.advanced").value(2));
  }

  @Test
  void 다른_job_은_안_섞인다() throws Exception {
    record("j2", true, "2026-07-01T00:00:00Z");

    mockMvc
        .perform(
            get("/internal/cron-runs/last-success").param("job", "j3").header("X-Internal-Secret", SECRET))
        .andExpect(status().isNoContent());
  }

  @Test
  void 집계_기본값이_없어도_기록된다() throws Exception {
    // recordCronRun 은 scanned·settled·advanced 를 optional 로 보낸다.
    mockMvc
        .perform(
            post("/internal/cron-runs")
                .header("X-Internal-Secret", SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"job\":\"j4\",\"ok\":true,\"started_at\":\"2026-07-01T00:00:00Z\"}"))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            get("/internal/cron-runs/last-success").param("job", "j4").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.scanned").value(0))
        .andExpect(jsonPath("$.error_count").value(0))
        .andExpect(jsonPath("$.errors").isArray());
  }
}
