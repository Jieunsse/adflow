package ai.adflow.api.timelog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ai.adflow.api.security.Role;
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

/** 작업 시간 기록 (기능 15, 정책서 28절). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TimeEntriesTest {

  @Autowired private MockMvc mockMvc;

  private static RequestPostProcessor as(String email, String role) {
    return jwt().jwt(j -> j.subject(email).claim("email", email))
        .authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }

  private ResultActions log(String email, String role, String brand, String stage, int minutes) throws Exception {
    return mockMvc.perform(
        post("/time-entries").with(as(email, role)).contentType(MediaType.APPLICATION_JSON)
            .content("{\"brandProfileId\":\"" + brand + "\",\"stage\":\"" + stage + "\",\"minutes\":" + minutes + "}"));
  }

  @Test
  void 역할별_기준을_넘으면_표시한다() {
    assertThat(TimeEntriesController.over(Role.MEMBER_PUBLISH, 135)).isTrue();
    assertThat(TimeEntriesController.over(Role.MEMBER_PUBLISH, 120)).isFalse();
    assertThat(TimeEntriesController.over(Role.MEMBER_REVIEW, 75)).isTrue();
    assertThat(TimeEntriesController.over(Role.LEAD, 600)).isFalse();
  }

  @Test
  void 십오분_단위로_남기고_팀장은_주간_합계를_본다() throws Exception {
    mockMvc
        .perform(post("/stores/brand-profiles").with(as("tl@example.com", "LEAD")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"item\":{\"id\":\"bp_tl\",\"name\":\"꽃\"}}"))
        .andExpect(status().isOk());
    mockMvc
        .perform(post("/workspace/members").with(as("tl@example.com", "LEAD")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"tlpm@example.com\",\"role\":\"팀원·게재\"}"))
        .andExpect(status().isOk());

    log("tlpm@example.com", "MEMBER_PUBLISH", "bp_tl", "creative", 20).andExpect(status().isBadRequest());
    log("tlpm@example.com", "MEMBER_PUBLISH", "bp_tl", "dance", 15).andExpect(status().isBadRequest());
    log("tlpm@example.com", "MEMBER_PUBLISH", "bp_other", "creative", 15).andExpect(status().isBadRequest());
    log("tlpm@example.com", "MEMBER_PUBLISH", "bp_tl", "creative", 90).andExpect(status().isOk());
    log("tlpm@example.com", "MEMBER_PUBLISH", "bp_tl", "report", 45).andExpect(status().isOk());

    mockMvc
        .perform(get("/time-entries").with(as("tlpm@example.com", "MEMBER_PUBLISH")))
        .andExpect(jsonPath("$.items.length()").value(2));
    mockMvc
        .perform(get("/time-entries/summary").with(as("tlpm@example.com", "MEMBER_PUBLISH")))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(get("/time-entries/summary").with(as("tl@example.com", "LEAD")))
        .andExpect(jsonPath("$.byBrand.bp_tl").value(135))
        .andExpect(jsonPath("$.byStage.creative").value(90))
        .andExpect(jsonPath("$.byMemberAndBrand[0].over").value(true));
  }
}
