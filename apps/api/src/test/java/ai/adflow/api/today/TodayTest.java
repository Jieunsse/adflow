package ai.adflow.api.today;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ai.adflow.api.learning.Learning;
import ai.adflow.api.learning.LearningRepository;
import ai.adflow.api.tournament.Tournament;
import ai.adflow.api.tournament.TournamentRepository;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.util.ArrayList;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** 오늘의 결정 1·2순위 (기능 5, 정책서 15.1). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TodayTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private TournamentRepository tournaments;
  @Autowired private LearningRepository learnings;

  private static RequestPostProcessor as(String email, String role) {
    return jwt().jwt(j -> j.subject(email).claim("email", email))
        .authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }

  private Tournament tournament(String ws, String id, String error) {
    Tournament.Variant v = new Tournament.Variant();
    v.setHeadline("h");
    v.setPrimaryText("p");
    Tournament t = new Tournament();
    t.setId(id);
    t.setOwnerKey(ws);
    t.setUpdatedAt(Instant.now());
    t.setBrandProfileId("bp_today");
    t.setProductId("p");
    t.setProductName("세럼");
    t.setTone("warm");
    t.setObjective("traffic");
    t.setDailyBudget(30000.0);
    t.setChampion(v);
    t.setChampionCtr(1.5);
    t.setChampionConfirmed(true);
    t.setAxisCursor(0);
    t.setSpentBudget(0.0);
    t.setStatus("running");
    t.setCreatedAt("2026-07-01T00:00:00Z");
    t.setRounds(new ArrayList<>());
    t.setLastError(error);
    return t;
  }

  @Test
  void 멈춘_실험이_먼저_오고_나머지는_나중에로_7일_미룰_수_있다() throws Exception {
    String ws = JsonPath.read(
        mockMvc.perform(get("/me").with(as("td@example.com", "LEAD"))).andReturn().getResponse().getContentAsString(),
        "$.workspaceId");
    tournaments.saveAndFlush(tournament(ws, "t_td_ok", null));
    tournaments.saveAndFlush(tournament(ws, "t_td_stop", "광고비가 하루 예산의 2배를 넘어 멈췄어요."));
    Learning l = new Learning();
    l.setId("t_td_ok_r1");
    l.setOwnerKey(ws);
    l.setUpdatedAt(Instant.now());
    l.setBrandProfileId("bp_today");
    l.setTournamentId("t_td_ok");
    l.setRoundIndex(1);
    l.setResult("no_difference");
    l.setStatus("draft");
    l.setCreatedAt(Instant.now().toString());
    learnings.save(l);

    mockMvc
        .perform(get("/today").with(as("td@example.com", "LEAD")))
        .andExpect(jsonPath("$.items[0].priority").value(1))
        .andExpect(jsonPath("$.items[0].link").value("/ab-tests/t_td_stop"))
        .andExpect(jsonPath("$.items[1].key").value("drafts:bp_today:1"));

    mockMvc
        .perform(post("/today/dismiss").with(as("td@example.com", "LEAD")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"key\":\"stopped:t_td_stop\"}"))
        .andExpect(status().isBadRequest());
    mockMvc
        .perform(post("/today/dismiss").with(as("td@example.com", "LEAD")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"key\":\"drafts:bp_today:1\"}"))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/today").with(as("td@example.com", "LEAD")))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].priority").value(1));

    // 다른 워크스페이스에는 보이지 않는다.
    mockMvc
        .perform(get("/today").with(as("td-other@example.com", "LEAD")))
        .andExpect(jsonPath("$.items").isEmpty());
  }
}
