package ai.adflow.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ai.adflow.api.connection.MetaConnectionRepository;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthExchangeControllerTest {

  private static final String SECRET_HEADER = "X-Internal-Secret";
  private static final String SECRET = "test-internal-secret";

  private static final String BODY =
      """
      {
        "ownerKey": "owner@example.com",
        "email": "owner@example.com",
        "role": "팀장",
        "metaConnection": {
          "accessToken": "EAAG-token",
          "adAccountId": "act_123",
          "igUsername": "greenroutine_official"
        }
      }
      """;

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtDecoder jwtDecoder;
  @Autowired private MetaConnectionRepository repository;

  @Test
  void 내부_시크릿이_없으면_401() throws Exception {
    mockMvc
        .perform(post("/auth/exchange").contentType(MediaType.APPLICATION_JSON).content(BODY))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 내부_시크릿이_틀리면_401() throws Exception {
    mockMvc
        .perform(
            post("/auth/exchange")
                .header(SECRET_HEADER, "wrong")
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 게스트는_거부한다() throws Exception {
    String guestBody = BODY.replace("owner@example.com", "guest@adflow.local");
    mockMvc
        .perform(
            post("/auth/exchange")
                .header(SECRET_HEADER, SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content(guestBody))
        .andExpect(status().isBadRequest());
  }

  @Test
  void 정상_교환이면_JWT와_역할클레임을_준다() throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/auth/exchange")
                    .header(SECRET_HEADER, SECRET)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(BODY))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").isNotEmpty())
            .andExpect(jsonPath("$.expiresAt").isNotEmpty())
            .andReturn();

    String token =
        JsonMapper.builder()
            .build()
            .readTree(result.getResponse().getContentAsString())
            .get("token")
            .asText();

    var jwt = jwtDecoder.decode(token);
    assertThat(jwt.getSubject()).isEqualTo("owner@example.com");
    assertThat(jwt.getClaimAsStringList("roles")).containsExactly("LEAD");
  }

  @Test
  void 교환하면_Meta연결이_저장된다() throws Exception {
    mockMvc
        .perform(
            post("/auth/exchange")
                .header(SECRET_HEADER, SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY))
        .andExpect(status().isOk());

    var saved = repository.findById("owner@example.com").orElseThrow();
    assertThat(saved.getAccessToken()).isEqualTo("EAAG-token");
    assertThat(saved.getAdAccountId()).isEqualTo("act_123");
    assertThat(saved.getIgUsername()).isEqualTo("greenroutine_official");
  }
}
