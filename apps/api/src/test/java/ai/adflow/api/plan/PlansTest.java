package ai.adflow.api.plan;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** 월간 계획과 총예산 상한 승인 (기능 12, 정책서 11.4) · 고객 역할 접근 제한 (정책서 5.1). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PlansTest {

  @Autowired private MockMvc mockMvc;

  private static RequestPostProcessor as(String email, String role) {
    return jwt().jwt(j -> j.subject(email).claim("email", email))
        .authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }

  private ResultActions json(MockHttpServletRequestBuilder req, String body) throws Exception {
    return mockMvc.perform(req.contentType(MediaType.APPLICATION_JSON).content(body));
  }

  private void brand(String lead, String brandId) throws Exception {
    json(post("/stores/brand-profiles").with(as(lead, "LEAD")), "{\"item\":{\"id\":\"" + brandId + "\",\"name\":\"브랜드\"}}")
        .andExpect(status().isOk());
  }

  private void client(String lead, String email, String brandId) throws Exception {
    json(
            post("/workspace/members").with(as(lead, "LEAD")),
            "{\"email\":\"" + email + "\",\"role\":\"고객\",\"brandProfileId\":\"" + brandId + "\"}")
        .andExpect(status().isOk());
  }

  private ResultActions save(String lead, String brandId, String month, String body) throws Exception {
    return json(put("/plans/" + brandId + "/" + month).with(as(lead, "LEAD")), body);
  }

  private static final String PLAN =
      "{\"budgetCap\":1000000,\"bundles\":\"[{\\\"goal\\\":\\\"클릭\\\",\\\"budget\\\":500000}]\",\"messageToClient\":\"확인해 주세요\"}";

  @Test
  void 고객을_추가할_때_브랜드가_필수이고_내_브랜드여야_하며_팀장은_못_넘긴다() throws Exception {
    String lead = "pl1@example.com";
    brand(lead, "bp_pl1");
    json(post("/workspace/members").with(as(lead, "LEAD")), "{\"email\":\"pl1c@example.com\",\"role\":\"고객\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("고객이 볼 브랜드를 골라 주세요."));
    json(
            post("/workspace/members").with(as(lead, "LEAD")),
            "{\"email\":\"pl1c@example.com\",\"role\":\"고객\",\"brandProfileId\":\"bp_other\"}")
        .andExpect(status().isBadRequest());
    client(lead, "pl1c@example.com", "bp_pl1");
    json(post("/workspace/members").with(as(lead, "LEAD")), "{\"email\":\"pl1c@example.com\",\"role\":\"팀장\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("고객에게는 팀장을 넘길 수 없어요."));
  }

  @Test
  void 고객은_포털과_알림만_쓰고_직원_경로는_403이다() throws Exception {
    String lead = "pl2@example.com";
    brand(lead, "bp_pl2");
    client(lead, "pl2c@example.com", "bp_pl2");

    mockMvc.perform(get("/stores/tournaments").with(as("pl2c@example.com", "CLIENT"))).andExpect(status().isForbidden());
    mockMvc.perform(get("/plans").with(as("pl2c@example.com", "CLIENT"))).andExpect(status().isForbidden());
    mockMvc.perform(get("/workspace/members").with(as("pl2c@example.com", "CLIENT"))).andExpect(status().isForbidden());
    mockMvc.perform(get("/me").with(as("pl2c@example.com", "CLIENT"))).andExpect(status().isOk());
    mockMvc.perform(get("/notifications").with(as("pl2c@example.com", "CLIENT"))).andExpect(status().isOk());
    mockMvc.perform(get("/portal/plans").with(as("pl2c@example.com", "CLIENT"))).andExpect(status().isOk());
    // 직원은 포털을 쓰지 않는다.
    mockMvc.perform(get("/portal/plans").with(as(lead, "LEAD"))).andExpect(status().isForbidden());
  }

  @Test
  void 요청하면_고객에게_알림이_가고_요청_뒤에는_고칠_수_없다() throws Exception {
    String lead = "pl3@example.com";
    brand(lead, "bp_pl3");
    client(lead, "pl3c@example.com", "bp_pl3");
    save(lead, "bp_pl3", "2026-12", PLAN).andExpect(jsonPath("$.status").value("draft"));
    mockMvc.perform(post("/plans/bp_pl3/2026-12/request").with(as(lead, "LEAD")))
        .andExpect(jsonPath("$.status").value("requested"));

    mockMvc.perform(get("/notifications").with(as("pl3c@example.com", "CLIENT")))
        .andExpect(jsonPath("$.items[0].kind").value("plan-requested"))
        .andExpect(jsonPath("$.items[0].link").value("/portal/plans/2026-12"));

    save(lead, "bp_pl3", "2026-12", PLAN).andExpect(status().isConflict());

    mockMvc.perform(post("/plans/bp_pl3/2026-12/cancel").with(as(lead, "LEAD")))
        .andExpect(jsonPath("$.status").value("draft"));
    save(lead, "bp_pl3", "2026-12", PLAN).andExpect(status().isOk());
  }

  @Test
  void 팀원_검토는_고칠_수_없고_상한_없이는_요청할_수_없다() throws Exception {
    String lead = "pl4@example.com";
    brand(lead, "bp_pl4");
    json(post("/workspace/members").with(as(lead, "LEAD")), "{\"email\":\"pl4r@example.com\",\"role\":\"팀원·검토\"}")
        .andExpect(status().isOk());
    save("pl4r@example.com", "bp_pl4", "2026-12", PLAN).andExpect(status().isForbidden());
    save(lead, "bp_pl4", "2026-12", "{\"bundles\":\"[]\"}").andExpect(status().isOk());
    mockMvc.perform(post("/plans/bp_pl4/2026-12/request").with(as(lead, "LEAD")))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("총예산 상한을 1원 이상 적은 뒤에 요청해 주세요."));
  }

  @Test
  void 고객은_반려_이유를_적어야_하고_반려하면_직원에게_알림이_간다() throws Exception {
    String lead = "pl5@example.com";
    brand(lead, "bp_pl5");
    client(lead, "pl5c@example.com", "bp_pl5");
    save(lead, "bp_pl5", "2026-12", PLAN);
    mockMvc.perform(post("/plans/bp_pl5/2026-12/request").with(as(lead, "LEAD")));

    json(post("/portal/plans/2026-12/reject").with(as("pl5c@example.com", "CLIENT")), "{\"reason\":\" \"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("반려하는 이유를 적어 주세요."));
    json(post("/portal/plans/2026-12/reject").with(as("pl5c@example.com", "CLIENT")), "{\"reason\":\"예산이 너무 많아요\"}")
        .andExpect(jsonPath("$.status").value("rejected"))
        .andExpect(jsonPath("$.rejectReason").value("예산이 너무 많아요"));
    mockMvc.perform(get("/notifications").with(as(lead, "LEAD")))
        .andExpect(jsonPath("$.items[0].kind").value("plan-rejected"));
  }

  @Test
  void 승인_뒤_상한은_줄일_수_있고_늘릴_수_없다() throws Exception {
    String lead = "pl6@example.com";
    brand(lead, "bp_pl6");
    client(lead, "pl6c@example.com", "bp_pl6");
    save(lead, "bp_pl6", "2026-12", PLAN);
    mockMvc.perform(post("/plans/bp_pl6/2026-12/request").with(as(lead, "LEAD")));
    mockMvc.perform(post("/portal/plans/2026-12/approve").with(as("pl6c@example.com", "CLIENT")))
        .andExpect(jsonPath("$.status").value("approved"))
        .andExpect(jsonPath("$.decidedBy").value("pl6c@example.com"));

    json(put("/portal/plans/2026-12/cap").with(as("pl6c@example.com", "CLIENT")), "{\"budgetCap\":1200000}")
        .andExpect(status().isBadRequest());
    json(put("/portal/plans/2026-12/cap").with(as("pl6c@example.com", "CLIENT")), "{\"budgetCap\":800000}")
        .andExpect(jsonPath("$.budgetCap").value(800000));

    // 승인된 계획은 직원이 바로 고칠 수 없고, 다시 만들기로 작성 중으로 돌린 뒤에 고친다. 승인 기록은 남는다.
    save(lead, "bp_pl6", "2026-12", PLAN).andExpect(status().isConflict());
    mockMvc.perform(post("/plans/bp_pl6/2026-12/reopen").with(as(lead, "LEAD")))
        .andExpect(jsonPath("$.status").value("draft"))
        .andExpect(jsonPath("$.decidedBy").value("pl6c@example.com"));
  }

  @Test
  void 고객은_다른_브랜드의_계획을_볼_수_없고_작성_중인_계획도_볼_수_없다() throws Exception {
    String lead = "pl7@example.com";
    brand(lead, "bp_pl7a");
    brand(lead, "bp_pl7b");
    client(lead, "pl7c@example.com", "bp_pl7a");
    save(lead, "bp_pl7a", "2026-12", PLAN);
    save(lead, "bp_pl7b", "2026-12", PLAN);
    mockMvc.perform(post("/plans/bp_pl7b/2026-12/request").with(as(lead, "LEAD")));

    // a 브랜드 계획은 아직 작성 중이라 안 보이고, b 브랜드 계획은 이 고객의 것이 아니다.
    mockMvc.perform(get("/portal/plans/2026-12").with(as("pl7c@example.com", "CLIENT"))).andExpect(status().isNotFound());
    mockMvc.perform(get("/portal/plans").with(as("pl7c@example.com", "CLIENT")))
        .andExpect(jsonPath("$.items.length()").value(0));
    mockMvc.perform(post("/portal/plans/2026-12/approve").with(as("pl7c@example.com", "CLIENT")))
        .andExpect(status().isNotFound());
  }
}
