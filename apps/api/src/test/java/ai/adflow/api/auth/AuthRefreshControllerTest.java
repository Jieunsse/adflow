package ai.adflow.api.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ai.adflow.api.security.Role;
import ai.adflow.api.security.TokenIssuer;
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
class AuthRefreshControllerTest {

  private static final String SECRET_HEADER = "X-Internal-Secret";
  private static final String SECRET = "test-internal-secret";

  @Autowired private MockMvc mockMvc;
  @Autowired private TokenIssuer tokenIssuer;

  private String body(String refreshToken) {
    return "{\"refreshToken\":\"" + refreshToken + "\"}";
  }

  private TokenIssuer.Issued issued() {
    return tokenIssuer.issue("owner@example.com", "owner@example.com", Role.MEMBER_REVIEW);
  }

  @Test
  void 내부_시크릿이_없으면_401() throws Exception {
    mockMvc
        .perform(
            post("/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(issued().refreshToken())))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 정상_갱신이면_새_토큰쌍을_준다() throws Exception {
    mockMvc
        .perform(
            post("/auth/refresh")
                .header(SECRET_HEADER, SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(issued().refreshToken())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").isNotEmpty())
        .andExpect(jsonPath("$.refreshToken").isNotEmpty())
        .andExpect(jsonPath("$.expiresAt").isNotEmpty())
        .andExpect(jsonPath("$.refreshExpiresAt").isNotEmpty());
  }

  @Test
  void access_토큰으로는_갱신할_수_없다() throws Exception {
    // 이게 typ 분리의 요지다.
    mockMvc
        .perform(
            post("/auth/refresh")
                .header(SECRET_HEADER, SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(issued().token())))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 쓰레기_토큰은_401() throws Exception {
    mockMvc
        .perform(
            post("/auth/refresh")
                .header(SECRET_HEADER, SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("not-a-jwt")))
        .andExpect(status().isUnauthorized());
  }
}
