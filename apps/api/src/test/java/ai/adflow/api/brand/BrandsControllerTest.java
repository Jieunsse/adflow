package ai.adflow.api.brand;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** 브랜드마다 광고 계정 1개·담당 직원 1명 (기능 10). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BrandsControllerTest {

  @Autowired private MockMvc mockMvc;

  private static RequestPostProcessor as(String email, String role) {
    return jwt().jwt(j -> j.subject(email).claim("email", email))
        .authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }

  private void brand(String lead, String id, String name) throws Exception {
    mockMvc
        .perform(
            post("/stores/brand-profiles")
                .with(as(lead, "LEAD"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":{\"id\":\"" + id + "\",\"name\":\"" + name + "\"}}"))
        .andExpect(status().isOk());
  }

  private void member(String lead, String email, String role) throws Exception {
    mockMvc
        .perform(
            post("/workspace/members")
                .with(as(lead, "LEAD"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"role\":\"" + role + "\"}"))
        .andExpect(status().isOk());
  }

  private ResultActions connect(String email, String brandId, String account) throws Exception {
    return mockMvc.perform(
        put("/brands/" + brandId + "/connection")
            .with(as(email, "LEAD"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"adAccountId\":\"" + account + "\",\"pageId\":\"pg_1\"}"));
  }

  @Test
  void 팀장이_연결하면_같은_워크스페이스_구성원이_읽는다() throws Exception {
    brand("b1lead@example.com", "bp_b1", "오늘의꽃");
    member("b1lead@example.com", "b1mate@example.com", "팀원·검토");
    connect("b1lead@example.com", "bp_b1", "act_b1").andExpect(status().isOk());

    mockMvc
        .perform(get("/brands/bp_b1").with(as("b1mate@example.com", "MEMBER_REVIEW")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.adAccountId").value("act_b1"))
        .andExpect(jsonPath("$.ownerKey").doesNotExist());

    mockMvc
        .perform(get("/brands/bp_b1").with(as("b1stranger@example.com", "LEAD")))
        .andExpect(status().isNotFound());
  }

  @Test
  void 담당_직원만_연결하고_담당이_아니면_막는다() throws Exception {
    brand("b2lead@example.com", "bp_b2", "숲");
    member("b2lead@example.com", "b2pm@example.com", "팀원·게재");
    member("b2lead@example.com", "b2other@example.com", "팀원·게재");

    connect("b2pm@example.com", "bp_b2", "act_b2").andExpect(status().isForbidden());

    mockMvc
        .perform(
            put("/brands/bp_b2/manager")
                .with(as("b2lead@example.com", "LEAD"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"b2pm@example.com\"}"))
        .andExpect(status().isOk());

    connect("b2pm@example.com", "bp_b2", "act_b2").andExpect(status().isOk());
    connect("b2other@example.com", "bp_b2", "act_b2x").andExpect(status().isForbidden());
  }

  @Test
  void 광고_계정은_브랜드_하나에만_연결한다() throws Exception {
    brand("b3lead@example.com", "bp_b3a", "가");
    brand("b3lead@example.com", "bp_b3b", "나");
    connect("b3lead@example.com", "bp_b3a", "act_b3").andExpect(status().isOk());

    connect("b3lead@example.com", "bp_b3b", "act_b3")
        .andExpect(status().isConflict());

    // 연결을 끊으면 다른 브랜드가 쓸 수 있다.
    mockMvc
        .perform(delete("/brands/bp_b3a/connection").with(as("b3lead@example.com", "LEAD")))
        .andExpect(status().isOk());
    connect("b3lead@example.com", "bp_b3b", "act_b3").andExpect(status().isOk());
  }

  @Test
  void 지운_브랜드의_연결은_계정을_붙잡지_않는다() throws Exception {
    brand("b4lead@example.com", "bp_b4a", "가");
    brand("b4lead@example.com", "bp_b4b", "나");
    connect("b4lead@example.com", "bp_b4a", "act_b4").andExpect(status().isOk());
    mockMvc
        .perform(delete("/stores/brand-profiles?id=bp_b4a").with(as("b4lead@example.com", "LEAD")))
        .andExpect(status().isOk());

    connect("b4lead@example.com", "bp_b4b", "act_b4").andExpect(status().isOk());
  }

  @Test
  void 다른_워크스페이스_브랜드에는_연결할_수_없다() throws Exception {
    brand("b5lead@example.com", "bp_b5", "가");
    connect("b5intruder@example.com", "bp_b5", "act_b5").andExpect(status().isNotFound());
  }
}
