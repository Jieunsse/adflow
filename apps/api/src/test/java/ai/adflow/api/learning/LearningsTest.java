package ai.adflow.api.learning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

/** 배운 것 기록 (기능 4, 정책서 14.1·14.2). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LearningsTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private LearningRepository repository;

  @Test
  void 문장은_결과만_쓰고_숫자는_기록과_같다() {
    assertThat(Learnings.sentence(Learnings.CHALLENGER_WON, "headline", 1.8, 2.4, 0.97, null))
        .isEqualTo("헤드라인을 바꾼 도전 소재가 기준 소재보다 클릭률이 0.6%p 높았어요. (기준 1.8%, 도전 2.4%, 신뢰도 97%)");
    assertThat(Learnings.sentence(Learnings.CHAMPION_WON, "primary_text", 2.4, 1.8, 0.95, null))
        .startsWith("본문을 바꾼 도전 소재가 기준 소재보다 클릭률이 0.6%p 낮았어요.");
    assertThat(Learnings.sentence(Learnings.NO_DIFFERENCE, "headline", 2.0, 2.05, 0.6, null))
        .isEqualTo("헤드라인을 바꿨지만 두 소재의 클릭률 차이가 뚜렷하지 않았어요. (기준 2.0%, 도전 2.1%)");
    assertThat(Learnings.sentence(Learnings.UNJUDGEABLE, "headline", null, null, null, 1620))
        .isEqualTo("헤드라인을 바꾼 실험은 노출이 1,620회 모자라 판정하지 못했어요.");
  }

  private static RequestPostProcessor as(String email, String role) {
    return jwt().jwt(j -> j.subject(email).claim("email", email))
        .authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }

  /** email 의 워크스페이스에 초안 하나를 넣는다. */
  private String draft(String email, String id) throws Exception {
    String ws =
        com.jayway.jsonpath.JsonPath.read(
            mockMvc.perform(get("/me").with(as(email, "LEAD"))).andReturn().getResponse().getContentAsString(),
            "$.workspaceId");
    Learning l = new Learning();
    l.setId(id);
    l.setOwnerKey(ws);
    l.setUpdatedAt(Instant.now());
    l.setBrandProfileId("bp_l");
    l.setTournamentId("t_l");
    l.setRoundIndex(1);
    l.setResult(Learnings.CHALLENGER_WON);
    l.setSentence("처음 문장");
    l.setStatus(Learnings.DRAFT);
    l.setCreatedAt(Instant.now().toString());
    repository.save(l);
    return ws;
  }

  @Test
  void 팀장이_확정하고_보관하고_다시_확정한다() throws Exception {
    draft("l1@example.com", "t_l1_r1");

    mockMvc
        .perform(post("/learnings/t_l1_r1/confirm").with(as("l1@example.com", "LEAD")))
        .andExpect(jsonPath("$.status").value("confirmed"));

    mockMvc
        .perform(
            post("/learnings/t_l1_r1/archive")
                .with(as("l1@example.com", "LEAD"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("보관하는 이유를 적어 주세요."));
    mockMvc
        .perform(
            post("/learnings/t_l1_r1/archive")
                .with(as("l1@example.com", "LEAD"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"시즌이 바뀌었어요\"}"))
        .andExpect(jsonPath("$.status").value("archived"));

    mockMvc
        .perform(post("/learnings/t_l1_r1/confirm").with(as("l1@example.com", "LEAD")))
        .andExpect(jsonPath("$.status").value("confirmed"))
        .andExpect(jsonPath("$.archiveReason").doesNotExist());
  }

  @Test
  void 팀원_검토는_확정할_수_없고_문장은_고칠_수_있다() throws Exception {
    draft("l2@example.com", "t_l2_r1");
    mockMvc
        .perform(
            post("/workspace/members")
                .with(as("l2@example.com", "LEAD"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"l2rev@example.com\",\"role\":\"팀원·검토\"}"))
        .andExpect(status().isOk());

    mockMvc
        .perform(post("/learnings/t_l2_r1/confirm").with(as("l2rev@example.com", "MEMBER_REVIEW")))
        .andExpect(status().isForbidden());

    mockMvc
        .perform(
            put("/learnings/t_l2_r1/sentence")
                .with(as("l2rev@example.com", "MEMBER_REVIEW"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"sentence\":\"고친 문장\"}"))
        .andExpect(jsonPath("$.sentence").value("고친 문장"))
        .andExpect(jsonPath("$.sentenceEditedBy").value("l2rev@example.com"))
        .andExpect(jsonPath("$.result").value("challenger_won"));

    mockMvc
        .perform(
            put("/learnings/t_l2_r1/sentence")
                .with(as("l2@example.com", "LEAD"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"sentence\":\"" + "가".repeat(201) + "\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void 다른_워크스페이스의_기록은_보이지_않는다() throws Exception {
    draft("l3@example.com", "t_l3_r1");
    mockMvc
        .perform(post("/learnings/t_l3_r1/confirm").with(as("l3other@example.com", "LEAD")))
        .andExpect(status().isNotFound());
    mockMvc
        .perform(get("/learnings?brandProfileId=bp_l").with(as("l3other@example.com", "LEAD")))
        .andExpect(jsonPath("$.items").isEmpty());
  }
}
