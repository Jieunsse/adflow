package ai.adflow.api.store.campaign;

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
class InfluencerCampaignControllerTest {

  private static final String ITEM =
      """
      {
        "id": "camp_1",
        "name": "여름 캠페인",
        "goal": "신규 유입",
        "budget": 3000000,
        "brandProfileId": "bp_1",
        "entries": [
          {
            "creatorId": "cr_1",
            "stage": "settled",
            "outreachDraft": "안녕하세요",
            "performance": {"campaignId": "camp_1", "reach": 5000, "revenue": 900000},
            "paidAt": "2026-06-20T00:00:00Z",
            "updatedAt": "2026-06-20T00:00:00Z"
          },
          {
            "creatorId": "cr_2",
            "stage": "negotiating",
            "updatedAt": "2026-06-21T00:00:00Z"
          }
        ],
        "createdAt": "2026-05-01T00:00:00Z"
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
            post("/stores/influencer-campaigns")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 파이프라인_엔트리가_순서와_중첩까지_왕복한다() throws Exception {
    save("a@example.com", ITEM);

    mockMvc
        .perform(get("/stores/influencer-campaigns").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].entries.length()").value(2))
        .andExpect(jsonPath("$.items[0].entries[0].creatorId").value("cr_1"))
        .andExpect(jsonPath("$.items[0].entries[0].stage").value("settled"))
        // 인라인 Performance 의 campaignId 가 조인 컬럼과 충돌하지 않고 값이 살아남아야 한다.
        .andExpect(jsonPath("$.items[0].entries[0].performance.campaignId").value("camp_1"))
        .andExpect(jsonPath("$.items[0].entries[0].performance.revenue").value(900000.0))
        .andExpect(jsonPath("$.items[0].entries[1].creatorId").value("cr_2"))
        .andExpect(jsonPath("$.items[0].entries[1].stage").value("negotiating"))
        // performance 는 optional 이라 키가 없어야 한다.
        .andExpect(jsonPath("$.items[0].entries[1].performance").doesNotExist())
        .andExpect(jsonPath("$.items[0].entries[1].paidAt").doesNotExist());
  }

  @Test
  void 엔트리를_줄여_저장하면_고아가_남지_않는다() throws Exception {
    save("b@example.com", ITEM);
    save("b@example.com", ITEM.replaceAll("(?s),\\s*\\{\\s*\"creatorId\": \"cr_2\".*?\\}", ""));

    mockMvc
        .perform(get("/stores/influencer-campaigns").with(owner("b@example.com")))
        .andExpect(jsonPath("$.items[0].entries.length()").value(1))
        .andExpect(jsonPath("$.items[0].entries[0].creatorId").value("cr_1"));
  }

  @Test
  void 빈_파이프라인도_배열로_나온다() throws Exception {
    // 텍스트 블록의 들여쓰기 제거 때문에 정규식으로 entries 를 비우면 위치에 따라 빗나간다.
    // 이 케이스가 보는 것은 "빈 배열이 null 로 뭉개지지 않는가" 하나뿐이라 최소 JSON 을 직접 쓴다.
    save(
        "c@example.com",
        """
        {
          "id": "camp_empty",
          "name": "빈 캠페인",
          "brandProfileId": "bp_1",
          "entries": [],
          "createdAt": "2026-05-01T00:00:00Z"
        }
        """);

    mockMvc
        .perform(get("/stores/influencer-campaigns").with(owner("c@example.com")))
        .andExpect(jsonPath("$.items[0].entries").isArray())
        .andExpect(jsonPath("$.items[0].entries.length()").value(0));
  }
}
