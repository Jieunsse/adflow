package ai.adflow.api.me;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ai.adflow.api.security.Role;
import ai.adflow.api.workspace.Member;
import ai.adflow.api.workspace.MemberRepository;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MeControllerTest {

  @Autowired private MockMvc mockMvc;

  @Autowired private MemberRepository members;

  @Test
  void 역할은_토큰이_아니라_소속에서_읽는다() throws Exception {
    // 토큰은 팀장이라고 주장하지만 DB 소속은 팀원·검토다.
    members.save(new Member("review@example.com", "ws_me_test", Role.MEMBER_REVIEW, Instant.EPOCH));
    mockMvc
        .perform(
            get("/me")
                .with(
                    jwt()
                        .jwt(
                            j ->
                                j.subject("review@example.com")
                                    .claim("email", "review@example.com")
                                    .claim("roles", List.of("LEAD")))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.workspaceId").value("ws_me_test"))
        .andExpect(jsonPath("$.role").value("팀원·검토"));
  }

  @Test
  void 처음_온_사람은_자기_워크스페이스의_팀장이다() throws Exception {
    mockMvc
        .perform(
            get("/me")
                .with(
                    jwt()
                        .jwt(
                            j ->
                                j.subject("owner@example.com")
                                    .claim("email", "owner@example.com")
                                    .claim("roles", List.of("MEMBER_REVIEW")))
                        .authorities(new SimpleGrantedAuthority("ROLE_MEMBER_REVIEW"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerKey").value("owner@example.com"))
        .andExpect(jsonPath("$.workspaceId").value(org.hamcrest.Matchers.startsWith("ws_")))
        .andExpect(jsonPath("$.role").value("팀장"));
  }

  @Test
  void 팀장은_연결을_삭제할_수_있다() throws Exception {
    mockMvc
        .perform(
            delete("/me/meta-connection")
                .with(
                    jwt()
                        .jwt(j -> j.subject("owner@example.com"))
                        .authorities(new SimpleGrantedAuthority("ROLE_LEAD"))))
        .andExpect(status().isNoContent());
  }

  @Test
  void 팀원은_연결을_삭제할_수_없다() throws Exception {
    mockMvc
        .perform(
            delete("/me/meta-connection")
                .with(
                    jwt()
                        .jwt(j -> j.subject("owner@example.com"))
                        .authorities(new SimpleGrantedAuthority("ROLE_MEMBER_PUBLISH"))))
        .andExpect(status().isForbidden());
  }
}
