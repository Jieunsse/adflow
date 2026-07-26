package ai.adflow.api.me;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

  @Test
  void 인증되면_내_정보를_준다() throws Exception {
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
        .andExpect(jsonPath("$.role").value("팀원·검토"));
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
