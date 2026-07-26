package ai.adflow.api.store.sop;

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
class SopControllerTest {

  // TS Sop 와 1:1. sections 는 type 마다 data 형태가 다른 판별 유니온이다.
  private static final String ITEM =
      """
      {
        "id": "sop_1",
        "name": "광고 정책",
        "description": "여름 캠페인용",
        "sections": [
          {"type": "prohibited_words", "data": {"words": ["최저가", "1위"]}, "source": "user"},
          {"type": "length_limits", "data": {"headline": 40, "body": 125}},
          {"type": "cta_restrictions", "data": {"blacklist": ["지금 클릭"], "note": "과장 금지"}}
        ],
        "createdAt": "2026-07-01T00:00:00Z",
        "updatedAt": "2026-07-02T00:00:00Z"
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
            post("/stores/sops")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc.perform(get("/stores/sops")).andExpect(status().isUnauthorized());
  }

  @Test
  void 판별유니온_sections_가_그대로_왕복한다() throws Exception {
    save("a@example.com", ITEM);

    mockMvc
        .perform(get("/stores/sops").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].id").value("sop_1"))
        .andExpect(jsonPath("$.items[0].name").value("광고 정책"))
        .andExpect(jsonPath("$.items[0].sections").isArray())
        .andExpect(jsonPath("$.items[0].sections[0].type").value("prohibited_words"))
        .andExpect(jsonPath("$.items[0].sections[0].data.words[1]").value("1위"))
        .andExpect(jsonPath("$.items[0].sections[1].data.headline").value(40))
        .andExpect(jsonPath("$.items[0].sections[2].data.note").value("과장 금지"))
        // 두 번째 항목엔 source 가 없다. optional 이 임의로 채워지면 안 된다.
        .andExpect(jsonPath("$.items[0].sections[1].source").doesNotExist())
        // 서버 전용 필드는 새면 안 되고, updatedAt 은 도메인 값이어야 한다(서버 시각 아님).
        .andExpect(jsonPath("$.items[0].ownerKey").doesNotExist())
        .andExpect(jsonPath("$.items[0].updatedAt").value("2026-07-02T00:00:00Z"));
  }

  @Test
  void description_이_없으면_키가_없다() throws Exception {
    save(
        "d@example.com",
        """
        {
          "id": "sop_nodesc",
          "name": "설명 없음",
          "sections": [],
          "createdAt": "2026-07-01T00:00:00Z",
          "updatedAt": "2026-07-01T00:00:00Z"
        }
        """);

    mockMvc
        .perform(get("/stores/sops").with(owner("d@example.com")))
        .andExpect(jsonPath("$.items[0].description").doesNotExist())
        // sections 는 required 다 — 빈 배열이 null 로 뭉개지면 화면이 .filter 에서 깨진다.
        .andExpect(jsonPath("$.items[0].sections").isArray())
        .andExpect(jsonPath("$.items[0].sections.length()").value(0));
  }

  @Test
  void 남의_SOP_는_보이지_않는다() throws Exception {
    save("b@example.com", ITEM.replace("sop_1", "sop_b"));
    mockMvc
        .perform(get("/stores/sops").with(owner("c@example.com")))
        .andExpect(jsonPath("$.items").isEmpty());
  }
}
