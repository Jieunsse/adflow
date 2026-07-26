package ai.adflow.api.store.onboarding;

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
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OnboardingControllerTest {

  @Autowired private MockMvc mockMvc;

  private RequestPostProcessor owner(String email) {
    return jwt()
        .jwt(j -> j.subject(email).claim("email", email).claim("roles", java.util.List.of("LEAD")))
        .authorities(new SimpleGrantedAuthority("ROLE_LEAD"));
  }

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc.perform(get("/stores/onboarding")).andExpect(status().isUnauthorized());
  }

  @Test
  void 등록_전에는_false_등록_후에는_true() throws Exception {
    mockMvc
        .perform(get("/stores/onboarding").with(owner("n@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.onboarded").value(false));

    mockMvc
        .perform(post("/stores/onboarding").with(owner("n@example.com")))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/stores/onboarding").with(owner("n@example.com")))
        .andExpect(jsonPath("$.onboarded").value(true));
  }

  @Test
  void 두_번_등록해도_깨지지_않는다() throws Exception {
    // 온보딩 완료 버튼이 두 번 눌릴 수 있다. PK 가 ownerKey 라 자연 멱등이어야 한다.
    mockMvc.perform(post("/stores/onboarding").with(owner("d@example.com"))).andExpect(status().isOk());
    mockMvc.perform(post("/stores/onboarding").with(owner("d@example.com"))).andExpect(status().isOk());

    mockMvc
        .perform(get("/stores/onboarding").with(owner("d@example.com")))
        .andExpect(jsonPath("$.onboarded").value(true));
  }

  @Test
  void 남의_등록은_내_상태가_아니다() throws Exception {
    mockMvc.perform(post("/stores/onboarding").with(owner("x@example.com"))).andExpect(status().isOk());

    mockMvc
        .perform(get("/stores/onboarding").with(owner("y@example.com")))
        .andExpect(jsonPath("$.onboarded").value(false));
  }

  @Test
  void 삭제하면_false_로_돌아간다() throws Exception {
    mockMvc.perform(post("/stores/onboarding").with(owner("r@example.com"))).andExpect(status().isOk());
    mockMvc.perform(delete("/stores/onboarding").with(owner("r@example.com"))).andExpect(status().isOk());

    mockMvc
        .perform(get("/stores/onboarding").with(owner("r@example.com")))
        .andExpect(jsonPath("$.onboarded").value(false));
  }

  @Test
  void 등록_없이_삭제해도_깨지지_않는다() throws Exception {
    mockMvc
        .perform(delete("/stores/onboarding").with(owner("never@example.com")))
        .andExpect(status().isOk());
  }
}
