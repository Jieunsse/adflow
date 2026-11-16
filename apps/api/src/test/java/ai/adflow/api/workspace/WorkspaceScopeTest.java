package ai.adflow.api.workspace;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ai.adflow.api.store.sop.Sop;
import ai.adflow.api.store.sop.SopRepository;
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

/** 저장 데이터의 주인이 사람이 아니라 워크스페이스라는 것, 그리고 구성원 관리 규칙 (정책서 5.2·5.3). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WorkspaceScopeTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private SopRepository sops;

  private static RequestPostProcessor as(String email, String role) {
    return jwt().jwt(j -> j.subject(email).claim("email", email))
        .authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }

  private void addMember(String lead, String email, String role) throws Exception {
    mockMvc
        .perform(
            post("/workspace/members")
                .with(as(lead, "LEAD"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"role\":\"" + role + "\"}"))
        .andExpect(status().isOk());
  }

  private void saveSop(String email, String id) throws Exception {
    mockMvc
        .perform(
            post("/stores/sops")
                .with(as(email, "LEAD"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":{\"id\":\"" + id + "\",\"name\":\"규칙\"}}"))
        .andExpect(status().isOk());
  }

  @Test
  void 같은_워크스페이스_구성원은_데이터를_함께_본다() throws Exception {
    saveSop("lead1@example.com", "sop_shared");
    addMember("lead1@example.com", "mate1@example.com", "팀원·게재");

    mockMvc
        .perform(get("/stores/sops").with(as("mate1@example.com", "MEMBER_PUBLISH")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].id").value("sop_shared"));

    // 다른 워크스페이스는 보지 못한다.
    mockMvc
        .perform(get("/stores/sops").with(as("stranger1@example.com", "LEAD")))
        .andExpect(jsonPath("$.items").isEmpty());
  }

  @Test
  void 워크스페이스_전에_이메일로_저장한_데이터는_첫_요청에서_옮겨진다() throws Exception {
    Sop legacy = new Sop();
    legacy.setId("sop_legacy");
    legacy.setName("예전 규칙");
    legacy.setOwnerKey("Legacy@example.com");
    legacy.setUpdatedAt(Instant.now());
    sops.save(legacy);

    mockMvc
        .perform(get("/stores/sops").with(as("Legacy@example.com", "LEAD")))
        .andExpect(jsonPath("$.items[0].id").value("sop_legacy"));
  }

  @Test
  void 팀원은_구성원을_추가하거나_브랜드_규칙을_고칠_수_없다() throws Exception {
    mockMvc
        .perform(
            post("/workspace/members")
                .with(as("mate2@example.com", "MEMBER_PUBLISH"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"x@example.com\",\"role\":\"팀원·검토\"}"))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            post("/stores/sops")
                .with(as("mate2@example.com", "MEMBER_PUBLISH"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":{\"id\":\"sop_x\",\"name\":\"규칙\"}}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void 내보낸_사람은_데이터를_보지_못한다() throws Exception {
    addMember("lead3@example.com", "gone3@example.com", "팀원·검토");
    mockMvc
        .perform(delete("/workspace/members?email=gone3@example.com").with(as("lead3@example.com", "LEAD")))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/stores/sops").with(as("gone3@example.com", "MEMBER_REVIEW")))
        .andExpect(status().isForbidden());
  }

  @Test
  void 팀장을_넘기면_원래_팀장은_팀원_게재가_된다() throws Exception {
    addMember("lead4@example.com", "next4@example.com", "팀원·게재");
    addMember("lead4@example.com", "next4@example.com", "팀장");

    mockMvc
        .perform(get("/workspace/members").with(as("next4@example.com", "LEAD")))
        .andExpect(jsonPath("$.items[?(@.email=='lead4@example.com')].role").value("팀원·게재"))
        .andExpect(jsonPath("$.items[?(@.email=='next4@example.com')].role").value("팀장"));
  }

  @Test
  void 다른_워크스페이스에_있는_사람은_추가할_수_없다() throws Exception {
    mockMvc.perform(get("/me").with(as("other5@example.com", "LEAD"))).andExpect(status().isOk());
    mockMvc
        .perform(
            post("/workspace/members")
                .with(as("lead5@example.com", "LEAD"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"other5@example.com\",\"role\":\"팀원·게재\"}"))
        .andExpect(status().isConflict());
  }
}
