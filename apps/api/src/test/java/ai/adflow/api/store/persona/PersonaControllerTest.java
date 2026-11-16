package ai.adflow.api.store.persona;

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
class PersonaControllerTest {

  // TS PersonaEntry 와 1:1. 원시 배열 셋(genders·location·interests)이 요점이다.
  private static final String ITEM =
      """
      {
        "id": "p_1",
        "brandProfileId": "bp_1",
        "name": "30대 직장인",
        "ageMin": 30,
        "ageMax": 39,
        "genders": [2],
        "location": ["서울", "경기"],
        "interests": ["헬스", "홈카페"],
        "customerDescription": "아침에 바쁜 사람"
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
            post("/stores/personas")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc.perform(get("/stores/personas")).andExpect(status().isUnauthorized());
  }

  @Test
  void 원시_배열_셋이_순서까지_왕복한다() throws Exception {
    save("a@example.com", ITEM);

    mockMvc
        .perform(get("/stores/personas").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].brandProfileId").value("bp_1"))
        .andExpect(jsonPath("$.items[0].ageMin").value(30))
        .andExpect(jsonPath("$.items[0].genders[0]").value(2))
        .andExpect(jsonPath("$.items[0].location[0]").value("서울"))
        .andExpect(jsonPath("$.items[0].location[1]").value("경기"))
        .andExpect(jsonPath("$.items[0].interests[1]").value("홈카페"))
        .andExpect(jsonPath("$.items[0].customerDescription").value("아침에 바쁜 사람"))
        .andExpect(jsonPath("$.items[0].ownerKey").doesNotExist());
  }

  @Test
  void 미설정_optional_은_키가_없다() throws Exception {
    save(
        "m@example.com",
        """
        {"id": "p_min", "brandProfileId": "bp_1", "name": "최소"}
        """);

    // TS 에서 genders·location·interests 는 전부 optional 이다.
    // 빈 배열로 채워 보내면 "타겟팅 미지정"과 "빈 타겟팅"이 구분되지 않는다.
    mockMvc
        .perform(get("/stores/personas").with(owner("m@example.com")))
        .andExpect(jsonPath("$.items[0].name").value("최소"))
        .andExpect(jsonPath("$.items[0].ageMin").doesNotExist())
        .andExpect(jsonPath("$.items[0].genders").doesNotExist())
        .andExpect(jsonPath("$.items[0].location").doesNotExist())
        .andExpect(jsonPath("$.items[0].customerDescription").doesNotExist());
  }

  @Test
  void 재저장하면_배열이_교체된다() throws Exception {
    save("r@example.com", ITEM.replace("p_1", "p_r"));
    save("r@example.com", ITEM.replace("p_1", "p_r").replace("[\"서울\", \"경기\"]", "[\"부산\"]"));

    mockMvc
        .perform(get("/stores/personas").with(owner("r@example.com")))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].location.length()").value(1))
        .andExpect(jsonPath("$.items[0].location[0]").value("부산"));
  }
}
