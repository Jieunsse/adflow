package ai.adflow.api.portal;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ai.adflow.api.learning.Learning;
import ai.adflow.api.learning.LearningRepository;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** 고객 화면 API (기능 11, 정책서 5.1·16.1). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PortalTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private LearningRepository learnings;

  private static RequestPostProcessor as(String email, String role) {
    return jwt().jwt(j -> j.subject(email).claim("email", email))
        .authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }

  private String setup(String lead, String brand, String client) throws Exception {
    mockMvc.perform(post("/stores/brand-profiles").with(as(lead, "LEAD")).contentType(MediaType.APPLICATION_JSON)
        .content("{\"item\":{\"id\":\"" + brand + "\",\"name\":\"오늘의꽃\"}}")).andExpect(status().isOk());
    mockMvc.perform(post("/workspace/members").with(as(lead, "LEAD")).contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"" + client + "\",\"role\":\"고객\",\"brandProfileId\":\"" + brand + "\"}")).andExpect(status().isOk());
    return JsonPath.read(mockMvc.perform(get("/me").with(as(lead, "LEAD"))).andReturn().getResponse().getContentAsString(), "$.workspaceId");
  }

  private void learning(String ws, String brand, String id, String status) {
    Learning l = new Learning();
    l.setId(id);
    l.setOwnerKey(ws);
    l.setUpdatedAt(Instant.now());
    l.setBrandProfileId(brand);
    l.setTournamentId("t");
    l.setRoundIndex(1);
    l.setResult("challenger_won");
    l.setSentence(id);
    l.setStatus(status);
    l.setCreatedAt(Instant.now().toString());
    learnings.save(l);
  }

  @Test
  void 고객은_자기_브랜드의_확정된_배운_것만_본다() throws Exception {
    String ws = setup("pt1@example.com", "bp_pt1", "c@pt1.com");
    learning(ws, "bp_pt1", "l_confirmed", "confirmed");
    learning(ws, "bp_pt1", "l_draft", "draft");
    learning(ws, "bp_other", "l_other", "confirmed");

    mockMvc.perform(get("/portal/learnings").with(as("c@pt1.com", "CLIENT")))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].sentence").value("l_confirmed"));
    mockMvc.perform(get("/portal/overview").with(as("c@pt1.com", "CLIENT")))
        .andExpect(jsonPath("$.brandName").value("오늘의꽃"))
        .andExpect(jsonPath("$.runningExperiments").value(0));
  }

  @Test
  void 공유한_리포트만_고객에게_보이고_다른_브랜드_리포트는_못_연다() throws Exception {
    setup("pt2@example.com", "bp_pt2", "c@pt2.com");
    mockMvc.perform(get("/portal/reports").with(as("c@pt2.com", "CLIENT"))).andExpect(jsonPath("$.items").isEmpty());

    mockMvc.perform(post("/reports/share").with(as("pt2@example.com", "LEAD")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"brandProfileId\":\"bp_pt2\",\"kind\":\"weekly\",\"rangeStart\":\"2026-11-02\",\"rangeEnd\":\"2026-11-08\",\"metricsJson\":\"[]\",\"reasonsJson\":\"[]\"}"))
        .andExpect(status().isOk());

    mockMvc.perform(get("/portal/reports").with(as("c@pt2.com", "CLIENT")))
        .andExpect(jsonPath("$.items[0].rangeStart").value("2026-11-02"));
    mockMvc.perform(get("/portal/reports/bp_pt2_weekly_2026-11-02").with(as("c@pt2.com", "CLIENT")))
        .andExpect(status().isOk());
    // 고객에게 알림이 간다.
    mockMvc.perform(get("/notifications").with(as("c@pt2.com", "CLIENT")))
        .andExpect(jsonPath("$.items[0].kind").value("report-shared"));

    setup("pt3@example.com", "bp_pt3", "c@pt3.com");
    mockMvc.perform(get("/portal/reports/bp_pt2_weekly_2026-11-02").with(as("c@pt3.com", "CLIENT")))
        .andExpect(status().isNotFound());
  }

  @Test
  void 고객사마다_고객은_3명까지_등록한다() throws Exception {
    setup("pt5@example.com", "bp_pt5", "c1@pt5.com");
    for (String e : new String[] {"c2@pt5.com", "c3@pt5.com"}) {
      mockMvc.perform(post("/workspace/members").with(as("pt5@example.com", "LEAD")).contentType(MediaType.APPLICATION_JSON)
          .content("{\"email\":\"" + e + "\",\"role\":\"고객\",\"brandProfileId\":\"bp_pt5\"}")).andExpect(status().isOk());
    }
    mockMvc.perform(post("/workspace/members").with(as("pt5@example.com", "LEAD")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"c4@pt5.com\",\"role\":\"고객\",\"brandProfileId\":\"bp_pt5\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void 고객은_리포트를_공유할_수_없고_직원은_고객_화면_API를_못_쓴다() throws Exception {
    setup("pt4@example.com", "bp_pt4", "c@pt4.com");
    mockMvc.perform(post("/reports/share").with(as("c@pt4.com", "CLIENT")).contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isForbidden());
    mockMvc.perform(get("/portal/overview").with(as("pt4@example.com", "LEAD"))).andExpect(status().isForbidden());
  }
}
