package ai.adflow.api.store.launch;

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
class CampaignLaunchControllerTest {

  // TS LaunchedCampaign 과 1:1. adIds 튜플과 abTestVariantB 판별 유니온이 요점이다.
  private static final String ITEM =
      """
      {
        "campaignId": "camp_1",
        "adSetId": "adset_1",
        "adIds": ["ad_a", "ad_b"],
        "dailyBudget": 30000,
        "startDate": "2026-07-01",
        "endDate": "2026-07-31",
        "status": "ACTIVE",
        "objective": "OUTCOME_SALES",
        "goalId": "sales",
        "quickStart": {"productId": "prd_1", "dailyBudget": "30,000", "durationDays": 31},
        "abTestAxis": "headline",
        "abTestVariantA": "아침을 바꾸는 한 잔",
        "abTestVariantB": {"axis": "headline", "headline": "하루를 여는 한 잔"}
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
            post("/stores/campaign-launches")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc.perform(get("/stores/campaign-launches")).andExpect(status().isUnauthorized());
  }

  @Test
  void 튜플과_판별유니온이_그대로_왕복한다() throws Exception {
    save("a@example.com", ITEM);

    mockMvc
        .perform(get("/stores/campaign-launches").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].campaignId").value("camp_1"))
        .andExpect(jsonPath("$.items[0].adSetId").value("adset_1"))
        // TS 는 [string, string] 튜플이다 — 길이 2 가 보존돼야 한다.
        .andExpect(jsonPath("$.items[0].adIds.length()").value(2))
        .andExpect(jsonPath("$.items[0].adIds[0]").value("ad_a"))
        .andExpect(jsonPath("$.items[0].adIds[1]").value("ad_b"))
        .andExpect(jsonPath("$.items[0].dailyBudget").value(30000))
        .andExpect(jsonPath("$.items[0].status").value("ACTIVE"))
        .andExpect(jsonPath("$.items[0].objective").value("OUTCOME_SALES"))
        .andExpect(jsonPath("$.items[0].goalId").value("sales"))
        .andExpect(jsonPath("$.items[0].quickStart.productId").value("prd_1"))
        .andExpect(jsonPath("$.items[0].abTestAxis").value("headline"))
        .andExpect(jsonPath("$.items[0].abTestVariantB.axis").value("headline"))
        .andExpect(jsonPath("$.items[0].abTestVariantB.headline").value("하루를 여는 한 잔"))
        .andExpect(jsonPath("$.items[0].id").doesNotExist())
        .andExpect(jsonPath("$.items[0].ownerKey").doesNotExist());
  }

  @Test
  void 단일광고_게재는_adIds_없이_adId_만_있다() throws Exception {
    save(
        "s@example.com",
        """
        {
          "campaignId": "camp_single",
          "adSetId": "adset_2",
          "adId": "ad_only",
          "dailyBudget": 10000,
          "startDate": "2026-07-01",
          "endDate": "2026-07-07",
          "status": "PAUSED"
        }
        """);

    mockMvc
        .perform(get("/stores/campaign-launches").with(owner("s@example.com")))
        .andExpect(jsonPath("$.items[0].adId").value("ad_only"))
        .andExpect(jsonPath("$.items[0].status").value("PAUSED"))
        .andExpect(jsonPath("$.items[0].adIds").doesNotExist())
        .andExpect(jsonPath("$.items[0].abTestVariantB").doesNotExist())
        .andExpect(jsonPath("$.items[0].skipped").doesNotExist());
  }

  @Test
  void 알_수_없는_status_는_400() throws Exception {
    mockMvc
        .perform(
            post("/stores/campaign-launches")
                .with(owner("a@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"item\":{\"campaignId\":\"c\",\"adSetId\":\"a\",\"dailyBudget\":1,"
                        + "\"startDate\":\"2026-07-01\",\"endDate\":\"2026-07-02\",\"status\":\"UNKNOWN\"}}"))
        .andExpect(status().isBadRequest());
  }
}
