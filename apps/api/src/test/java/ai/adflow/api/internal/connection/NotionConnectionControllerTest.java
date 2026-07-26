package ai.adflow.api.internal.connection;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

/** Notion 연결 (ADR-043) — 단계 7 에서 Supabase 에서 넘어왔다. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotionConnectionControllerTest {

  private static final String SECRET = "test-internal-secret";

  @Autowired private MockMvc mockMvc;

  private void save(String userKey, String token) throws Exception {
    mockMvc
        .perform(
            post("/internal/notion-connections")
                .header("X-Internal-Secret", SECRET)
                .param("userKey", userKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"accessToken":"%s","botId":"bot_1","workspaceId":"ws_1",
                     "workspaceName":"내 워크스페이스","workspaceIcon":"https://x/icon.png"}
                    """
                        .formatted(token)))
        .andExpect(status().isOk());
  }

  @Test
  void 시크릿이_없으면_401() throws Exception {
    mockMvc
        .perform(get("/internal/notion-connections").param("userKey", "u@x.com"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 연결이_없으면_204() throws Exception {
    // 404 로 두면 호출자가 "아직 연결 안 함"과 "고장"을 구분하지 못한다.
    mockMvc
        .perform(get("/internal/notion-connections").header("X-Internal-Secret", SECRET).param("userKey", "없음"))
        .andExpect(status().isNoContent());
  }

  @Test
  void 토큰이_없으면_400() throws Exception {
    mockMvc
        .perform(
            post("/internal/notion-connections")
                .header("X-Internal-Secret", SECRET)
                .param("userKey", "u@x.com")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"botId\":\"bot_1\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void 저장한_연결이_그대로_돌아온다() throws Exception {
    save("a@example.com", "secret_notion_token");

    mockMvc
        .perform(
            get("/internal/notion-connections").header("X-Internal-Secret", SECRET).param("userKey", "a@example.com"))
        .andExpect(status().isOk())
        // 폴더 조회에 쓰려면 평문으로 돌아와야 한다(저장은 암호화 컬럼).
        .andExpect(jsonPath("$.accessToken").value("secret_notion_token"))
        .andExpect(jsonPath("$.workspaceName").value("내 워크스페이스"))
        // 서버 전용 필드가 새면 TS 타입과 어긋난다.
        .andExpect(jsonPath("$.userKey").doesNotExist())
        .andExpect(jsonPath("$.updatedAt").doesNotExist());
  }

  @Test
  void 다시_저장하면_덮어쓴다() throws Exception {
    save("b@example.com", "old_token");
    save("b@example.com", "new_token");

    mockMvc
        .perform(
            get("/internal/notion-connections").header("X-Internal-Secret", SECRET).param("userKey", "b@example.com"))
        .andExpect(jsonPath("$.accessToken").value("new_token"));
  }

  @Test
  void 남의_연결은_안_보인다() throws Exception {
    save("c@example.com", "c_token");

    mockMvc
        .perform(
            get("/internal/notion-connections").header("X-Internal-Secret", SECRET).param("userKey", "d@example.com"))
        .andExpect(status().isNoContent());
  }

  @Test
  void 연결을_끊으면_사라진다() throws Exception {
    save("e@example.com", "e_token");

    mockMvc
        .perform(
            delete("/internal/notion-connections").header("X-Internal-Secret", SECRET).param("userKey", "e@example.com"))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            get("/internal/notion-connections").header("X-Internal-Secret", SECRET).param("userKey", "e@example.com"))
        .andExpect(status().isNoContent());
  }
}
