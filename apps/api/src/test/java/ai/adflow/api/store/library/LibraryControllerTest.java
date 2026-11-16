package ai.adflow.api.store.library;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
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
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LibraryControllerTest {

  // TS LibraryItem 과 필드가 1:1 이다. image 는 optional 이라 뺀다.
  private static final String ITEM =
      """
      {
        "id": "cre_1",
        "savedAt": 1753500000000,
        "brand": "그린루틴",
        "headline": "아침을 바꾸는 한 잔",
        "primary": "매일 마시는 루틴",
        "tone": "warm",
        "toneLabel": "따뜻하게",
        "ctaId": "SHOP_NOW",
        "ctaLabel": "지금 구매",
        "goal": "conversions",
        "target": "30대 여성",
        "gradient": "sunrise",
        "tag": "신규"
      }
      """;

  @Autowired private MockMvc mockMvc;

  private RequestPostProcessor owner(String email) {
    return jwt()
        .jwt(j -> j.subject(email).claim("email", email).claim("roles", java.util.List.of("LEAD")))
        .authorities(new SimpleGrantedAuthority("ROLE_LEAD"));
  }

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc.perform(get("/stores/library")).andExpect(status().isUnauthorized());
  }

  @Test
  void 저장하고_읽으면_와이어_형태가_그대로다() throws Exception {
    mockMvc
        .perform(
            post("/stores/library")
                .with(owner("a@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + ITEM + "}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ok").value(true));

    mockMvc
        .perform(get("/stores/library").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].id").value("cre_1"))
        .andExpect(jsonPath("$.items[0].savedAt").value(1753500000000L))
        .andExpect(jsonPath("$.items[0].primary").value("매일 마시는 루틴"))
        .andExpect(jsonPath("$.items[0].ctaLabel").value("지금 구매"))
        // 서버 전용 필드가 와이어로 새면 안 된다.
        .andExpect(jsonPath("$.items[0].ownerKey").doesNotExist())
        .andExpect(jsonPath("$.items[0].updatedAt").doesNotExist())
        // optional 미설정 필드는 키 자체가 없어야 한다 — TS 의 image?: string 과 맞추려면 null 이 아니라 부재다.
        .andExpect(jsonPath("$.items[0].image").doesNotExist());
  }

  @Test
  void 남의_항목은_보이지_않는다() throws Exception {
    mockMvc
        .perform(
            post("/stores/library")
                .with(owner("b@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + ITEM.replace("cre_1", "cre_b") + "}"))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/stores/library").with(owner("c@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items").isEmpty());
  }

  @Test
  void 남의_항목은_삭제되지_않는다() throws Exception {
    mockMvc
        .perform(
            post("/stores/library")
                .with(owner("d@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + ITEM.replace("cre_1", "cre_d") + "}"))
        .andExpect(status().isOk());

    // 다른 사람이 같은 id 로 삭제를 시도해도 지워지면 안 된다.
    mockMvc
        .perform(delete("/stores/library").param("id", "cre_d").with(owner("e@example.com")))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/stores/library").with(owner("d@example.com")))
        .andExpect(jsonPath("$.items[0].id").value("cre_d"));
  }

  @Test
  void id_없는_항목은_400() throws Exception {
    mockMvc
        .perform(
            post("/stores/library")
                .with(owner("a@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":{\"brand\":\"이름만\"}}"))
        .andExpect(status().isBadRequest());
  }
}
