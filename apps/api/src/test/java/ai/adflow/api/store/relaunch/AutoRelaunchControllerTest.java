package ai.adflow.api.store.relaunch;

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
class AutoRelaunchControllerTest {

  // TS AutoRelaunchEntry 와 1:1. 식별자가 id 가 아니라 campaignId 인 것이 요점이다.
  private static final String ITEM =
      """
      {
        "campaignId": "camp_1",
        "enabled": true,
        "cycleCount": 3,
        "parentCampaignId": "camp_0",
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
            post("/stores/auto-relaunch")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc.perform(get("/stores/auto-relaunch")).andExpect(status().isUnauthorized());
  }

  @Test
  void 와이어는_campaignId_이고_id_는_노출되지_않는다() throws Exception {
    save("a@example.com", ITEM);

    mockMvc
        .perform(get("/stores/auto-relaunch").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].campaignId").value("camp_1"))
        .andExpect(jsonPath("$.items[0].enabled").value(true))
        .andExpect(jsonPath("$.items[0].cycleCount").value(3))
        .andExpect(jsonPath("$.items[0].parentCampaignId").value("camp_0"))
        .andExpect(jsonPath("$.items[0].updatedAt").value("2026-07-02T00:00:00Z"))
        // TS AutoRelaunchEntry 에 id 가 없다. 새어 나가면 계약 위반이다.
        .andExpect(jsonPath("$.items[0].id").doesNotExist())
        .andExpect(jsonPath("$.items[0].ownerKey").doesNotExist());
  }

  @Test
  void parentCampaignId_가_없으면_키가_없다() throws Exception {
    save(
        "n@example.com",
        """
        {
          "campaignId": "camp_root",
          "enabled": false,
          "cycleCount": 1,
          "createdAt": "2026-07-01T00:00:00Z",
          "updatedAt": "2026-07-01T00:00:00Z"
        }
        """);

    mockMvc
        .perform(get("/stores/auto-relaunch").with(owner("n@example.com")))
        .andExpect(jsonPath("$.items[0].enabled").value(false))
        .andExpect(jsonPath("$.items[0].parentCampaignId").doesNotExist());
  }

  @Test
  void campaignId_로_삭제된다() throws Exception {
    save("d@example.com", ITEM.replace("camp_1", "camp_d"));

    mockMvc
        .perform(delete("/stores/auto-relaunch").param("id", "camp_d").with(owner("d@example.com")))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/stores/auto-relaunch").with(owner("d@example.com")))
        .andExpect(jsonPath("$.items").isEmpty());
  }

  @Test
  void campaignId_없이_저장하면_400() throws Exception {
    mockMvc
        .perform(
            post("/stores/auto-relaunch")
                .with(owner("a@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":{\"enabled\":true,\"cycleCount\":1}}"))
        .andExpect(status().isBadRequest());
  }
}
