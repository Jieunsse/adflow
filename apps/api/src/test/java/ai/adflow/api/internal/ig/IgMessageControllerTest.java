package ai.adflow.api.internal.ig;

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
class IgMessageControllerTest {

  private static final String SECRET = "test-internal-secret";

  @Autowired private MockMvc mockMvc;

  private void upsert(String body) throws Exception {
    mockMvc
        .perform(
            post("/internal/ig-messages")
                .header("X-Internal-Secret", SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk());
  }

  @Test
  void 시크릿이_없으면_401() throws Exception {
    mockMvc
        .perform(get("/internal/ig-messages").param("igUserId", "ig_1"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 시크릿이_틀리면_401() throws Exception {
    mockMvc
        .perform(
            post("/internal/ig-messages")
                .header("X-Internal-Secret", "wrong")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"items\":[]}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 필수값이_없는_메시지는_400() throws Exception {
    mockMvc
        .perform(
            post("/internal/ig-messages")
                .header("X-Internal-Secret", SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"items\":[{\"id\":\"m1\"}]}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void 인박스는_최신순_스레드는_오래된_순() throws Exception {
    upsert(
        """
        {"items":[
          {"id":"m1","igUserId":"ig_1","conversationId":"c1","participantId":"p1",
           "participantHandle":"minji","fromMe":false,"text":"안녕","createdAt":"2026-07-01T00:00:00Z"},
          {"id":"m2","igUserId":"ig_1","conversationId":"c1","participantId":"p1",
           "fromMe":true,"text":"네","createdAt":"2026-07-02T00:00:00Z"}
        ]}
        """);

    mockMvc
        .perform(get("/internal/ig-messages").param("igUserId", "ig_1").header("X-Internal-Secret", SECRET))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].id").value("m2"));

    mockMvc
        .perform(
            get("/internal/ig-messages")
                .param("igUserId", "ig_1")
                .param("conversationId", "c1")
                .header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.items[0].id").value("m1"))
        .andExpect(jsonPath("$.items[0].participantHandle").value("minji"))
        .andExpect(jsonPath("$.items[0].fromMe").value(false))
        // handle 이 없는 행에서 키가 임의로 채워지면 화면이 'unknown' 폴백을 못 쓴다.
        .andExpect(jsonPath("$.items[1].participantHandle").doesNotExist())
        .andExpect(jsonPath("$.items[1].attachmentUrl").doesNotExist());
  }

  @Test
  void 남의_igUserId_로는_같은_대화가_안_보인다() throws Exception {
    // 의도된 편차 #3 — 지금(Supabase)은 conversationId 만 알면 남의 스레드가 나온다.
    upsert(
        """
        {"items":[{"id":"s1","igUserId":"ig_owner","conversationId":"c_secret",
          "participantId":"p","fromMe":false,"text":"비밀","createdAt":"2026-07-01T00:00:00Z"}]}
        """);

    mockMvc
        .perform(
            get("/internal/ig-messages")
                .param("igUserId", "ig_other")
                .param("conversationId", "c_secret")
                .header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.items").isEmpty());
  }

  @Test
  void 같은_id_를_다시_넣으면_교체된다() throws Exception {
    // 인박스 씨앗과 스레드 열람이 같은 메시지를 두 번 넣는다 — 중복되면 화면에 두 줄로 뜬다.
    upsert(
        """
        {"items":[{"id":"dup","igUserId":"ig_d","conversationId":"c","participantId":"p",
          "fromMe":false,"text":"처음","createdAt":"2026-07-01T00:00:00Z"}]}
        """);
    upsert(
        """
        {"items":[{"id":"dup","igUserId":"ig_d","conversationId":"c","participantId":"p",
          "fromMe":false,"text":"나중","createdAt":"2026-07-01T00:00:00Z"}]}
        """);

    mockMvc
        .perform(get("/internal/ig-messages").param("igUserId", "ig_d").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].text").value("나중"));
  }

  @Test
  void 대화_id_역조회는_최근_것을_준다() throws Exception {
    upsert(
        """
        {"items":[{"id":"r1","igUserId":"ig_r","conversationId":"c_real","participantId":"p_r",
          "fromMe":false,"text":"x","createdAt":"2026-07-01T00:00:00Z"}]}
        """);

    mockMvc
        .perform(
            get("/internal/ig-messages/conversation-id")
                .param("igUserId", "ig_r")
                .param("participantId", "p_r")
                .header("X-Internal-Secret", SECRET))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.conversationId").value("c_real"));
  }

  @Test
  void 역조회할_것이_없으면_204() throws Exception {
    mockMvc
        .perform(
            get("/internal/ig-messages/conversation-id")
                .param("igUserId", "ig_none")
                .param("participantId", "p_none")
                .header("X-Internal-Secret", SECRET))
        .andExpect(status().isNoContent());
  }
}
