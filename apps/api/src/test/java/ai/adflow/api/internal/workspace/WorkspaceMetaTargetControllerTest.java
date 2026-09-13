package ai.adflow.api.internal.workspace;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
class WorkspaceMetaTargetControllerTest {

  private static final String SECRET = "test-internal-secret";

  @Autowired private MockMvc mockMvc;

  @Test
  void 내부_시크릿이_없으면_401() throws Exception {
    mockMvc.perform(get("/internal/workspace-meta-target")).andExpect(status().isUnauthorized());
  }

  @Test
  void target은_전역으로_저장되고_audit에_남는다() throws Exception {
    mockMvc
        .perform(
            patch("/internal/workspace-meta-target")
                .header("X-Internal-Secret", SECRET)
                .queryParam("actor", "alice")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"igUserId\":\"ig_1\",\"pageId\":\"page_1\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.target.igUserId").value("ig_1"));

    mockMvc
        .perform(get("/internal/workspace-meta-target").header("X-Internal-Secret", SECRET))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.target.pageId").value("page_1"));

    mockMvc
        .perform(get("/internal/workspace-meta-target/audit").header("X-Internal-Secret", SECRET))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].actor").value("alice"))
        .andExpect(jsonPath("$[0].after.igUserId").value("ig_1"));
  }
}
