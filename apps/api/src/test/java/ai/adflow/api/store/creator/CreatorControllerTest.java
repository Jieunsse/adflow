package ai.adflow.api.store.creator;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
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
class CreatorControllerTest {

  // TS Creator 와 1:1. 순서가 있는 배열 두 개가 이 Task 의 요점이다.
  private static final String ITEM =
      """
      {
        "id": "cr_1",
        "handle": "@greenroutine",
        "platform": "instagram",
        "displayName": "그린루틴",
        "category": ["뷰티", "푸드", "라이프"],
        "followerCount": 12000,
        "performanceHistory": [
          {"campaignId": "camp_1", "reach": 1000, "clicks": 80, "recordedAt": "2026-05-01T00:00:00Z"},
          {"campaignId": "camp_2", "reach": 2000, "conversions": 12, "recordedAt": "2026-06-01T00:00:00Z"}
        ],
        "createdAt": "2026-04-01T00:00:00Z"
      }
      """;

  @Autowired private MockMvc mockMvc;

  private RequestPostProcessor owner(String email) {
    return jwt()
        .jwt(j -> j.subject(email).claim("email", email).claim("roles", java.util.List.of("LEAD")))
        .authorities(new SimpleGrantedAuthority("ROLE_LEAD"));
  }

  private void save(String email, String item) throws Exception {
    mockMvc
        .perform(
            post("/stores/creators")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 중첩_배열이_순서까지_그대로_왕복한다() throws Exception {
    save("a@example.com", ITEM);

    mockMvc
        .perform(get("/stores/creators").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].category[0]").value("뷰티"))
        .andExpect(jsonPath("$.items[0].category[2]").value("라이프"))
        .andExpect(jsonPath("$.items[0].performanceHistory[0].campaignId").value("camp_1"))
        .andExpect(jsonPath("$.items[0].performanceHistory[1].conversions").value(12))
        .andExpect(jsonPath("$.items[0].platform").value("instagram"))
        // optional 미설정은 키 부재.
        .andExpect(jsonPath("$.items[0].note").doesNotExist())
        .andExpect(jsonPath("$.items[0].performanceHistory[0].conversions").doesNotExist());
  }

  @Test
  void 재저장하면_이전_컬렉션이_남지_않는다() throws Exception {
    save("b@example.com", ITEM);
    // 같은 id 로 카테고리 1개짜리를 다시 저장한다. 고아가 남으면 3개가 그대로 보인다.
    save("b@example.com", ITEM.replace("[\"뷰티\", \"푸드\", \"라이프\"]", "[\"뷰티\"]"));

    mockMvc
        .perform(get("/stores/creators").with(owner("b@example.com")))
        .andExpect(jsonPath("$.items[0].category.length()").value(1))
        .andExpect(jsonPath("$.items.length()").value(1));
  }

  @Test
  void 빈_배열은_null_이_아니라_빈_배열로_나온다() throws Exception {
    save(
        "c@example.com",
        ITEM.replace("cr_1", "cr_empty")
            .replace("[\"뷰티\", \"푸드\", \"라이프\"]", "[]")
            .replaceAll("(?s)\"performanceHistory\": \\[.*?\\]", "\"performanceHistory\": []"));

    mockMvc
        .perform(get("/stores/creators").with(owner("c@example.com")))
        // TS 의 category: string[] 는 required 다. null 이나 키 부재면 프론트가 깨진다.
        .andExpect(jsonPath("$.items[0].category").isArray())
        .andExpect(jsonPath("$.items[0].category.length()").value(0))
        .andExpect(jsonPath("$.items[0].performanceHistory").isArray());
  }
}
