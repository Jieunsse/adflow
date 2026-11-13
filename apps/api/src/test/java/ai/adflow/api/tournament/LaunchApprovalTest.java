package ai.adflow.api.tournament;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ai.adflow.api.meta.MetaSplitTestLauncher;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** 게재 요청과 승인 (기능 7, 정책서 11.1·11.2). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(LaunchApprovalTest.Stubs.class)
class LaunchApprovalTest {

  static class StubLauncher extends TournamentRoundLauncher {
    static int calls = 0;
    static RuntimeException failure = null;

    StubLauncher() {
      super(null, java.time.Clock.systemUTC());
    }

    @Override
    public MetaSplitTestLauncher.LaunchResult launch(Tournament t, TourRound round) {
      calls += 1;
      if (failure != null) throw failure;
      return new MetaSplitTestLauncher.LaunchResult(
          "camp_1", List.of("adset_1", "adset_2"), List.of("ad_1", "ad_2"), "study_1");
    }
  }

  @TestConfiguration
  static class Stubs {
    @Bean
    @Primary
    TournamentRoundLauncher stubLauncher() {
      return new StubLauncher();
    }
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private TournamentRepository repository;

  @BeforeEach
  void reset() {
    StubLauncher.calls = 0;
    StubLauncher.failure = null;
  }

  private static RequestPostProcessor as(String email, String role) {
    return jwt().jwt(j -> j.subject(email).claim("email", email))
        .authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }

  private static Tournament.Variant variant(String h) {
    Tournament.Variant v = new Tournament.Variant();
    v.setHeadline(h);
    v.setPrimaryText("본문");
    return v;
  }

  /** lead 의 워크스페이스에 브랜드·연결·초안이 있는 실험을 만든다. */
  private void setup(String lead, String brandId, String id) throws Exception {
    mockMvc
        .perform(
            post("/stores/brand-profiles")
                .with(as(lead, "LEAD"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":{\"id\":\"" + brandId + "\",\"name\":\"브랜드\"}}"))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            put("/brands/" + brandId + "/connection")
                .with(as(lead, "LEAD"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"adAccountId\":\"act_" + id + "\",\"pageId\":\"pg_1\"}"))
        .andExpect(status().isOk());
    String ws =
        com.jayway.jsonpath.JsonPath.read(
            mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/me").with(as(lead, "LEAD")))
                .andReturn().getResponse().getContentAsString(),
            "$.workspaceId");

    Tournament t = new Tournament();
    t.setId(id);
    t.setOwnerKey(ws);
    t.setUpdatedAt(Instant.now());
    t.setBrandProfileId(brandId);
    t.setProductId("p");
    t.setProductName("세럼");
    t.setTone("warm");
    t.setObjective("traffic");
    t.setDailyBudget(30000.0);
    t.setChampion(variant("기준"));
    t.setChampionCtr(1.5);
    t.setChampionConfirmed(true);
    t.setAxisCursor(0);
    t.setSpentBudget(0.0);
    t.setStatus("running");
    t.setCreatedAt("2026-07-01T00:00:00Z");
    t.setRounds(new ArrayList<>());
    t.setPendingChallenger(variant("도전"));
    TournamentDelivery d = new TournamentDelivery();
    d.setAccessToken("tok");
    d.setAdAccountId("act_old");
    d.setPageId("pg_old");
    d.setOwnerEmail(lead);
    d.setLinkUrl("https://x.com");
    d.setCtaType("LEARN_MORE");
    d.setCountries(List.of("KR"));
    d.setAgeMin(20);
    d.setAgeMax(45);
    d.setRoundDays(4);
    t.setDelivery(d);
    repository.saveAndFlush(t);
  }

  private ResultActions call(String email, String role, String id, String path, String body)
      throws Exception {
    var req = post("/stores/tournaments/" + id + "/launch-request" + path).with(as(email, role));
    if (body != null) req = req.contentType(MediaType.APPLICATION_JSON).content(body);
    return mockMvc.perform(req);
  }

  @Test
  void 요청만으로는_게재되지_않고_승인하면_한_번_게재된다() throws Exception {
    setup("ap1@example.com", "bp_ap1", "t_ap1");

    call("ap1@example.com", "LEAD", "t_ap1", "", null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.launchRequest.status").value("pending"));
    assertThat(StubLauncher.calls).isZero();

    call("ap1@example.com", "LEAD", "t_ap1", "/approve", null).andExpect(status().isOk());
    assertThat(StubLauncher.calls).isEqualTo(1);

    // 두 번째 승인은 거절되고 광고는 다시 만들어지지 않는다.
    call("ap1@example.com", "LEAD", "t_ap1", "/approve", null)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.error").value("이미 처리된 요청이에요. 화면을 새로 고쳐 주세요."));
    assertThat(StubLauncher.calls).isEqualTo(1);

    Tournament t = repository.findById("t_ap1").orElseThrow();
    assertThat(t.getRounds()).hasSize(1);
    assertThat(t.getLaunchRequest()).isNull();
    // 승인 시점의 브랜드 연결로 올렸다.
    assertThat(t.getDelivery().getAdAccountId()).isEqualTo("act_t_ap1");
  }

  @Test
  void 담당이_아닌_팀원은_승인할_수_없다() throws Exception {
    setup("ap2@example.com", "bp_ap2", "t_ap2");
    mockMvc
        .perform(
            post("/workspace/members")
                .with(as("ap2@example.com", "LEAD"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"ap2pm@example.com\",\"role\":\"팀원·게재\"}"))
        .andExpect(status().isOk());

    call("ap2pm@example.com", "MEMBER_PUBLISH", "t_ap2", "", null).andExpect(status().isOk());
    call("ap2pm@example.com", "MEMBER_PUBLISH", "t_ap2", "/approve", null)
        .andExpect(status().isForbidden());

    // 담당으로 정하면 승인할 수 있다.
    mockMvc
        .perform(
            put("/brands/bp_ap2/manager")
                .with(as("ap2@example.com", "LEAD"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"ap2pm@example.com\"}"))
        .andExpect(status().isOk());
    call("ap2pm@example.com", "MEMBER_PUBLISH", "t_ap2", "/approve", null)
        .andExpect(status().isOk());
  }

  @Test
  void 반려는_이유가_10자_이상이어야_한다() throws Exception {
    setup("ap3@example.com", "bp_ap3", "t_ap3");
    call("ap3@example.com", "LEAD", "t_ap3", "", null).andExpect(status().isOk());

    call("ap3@example.com", "LEAD", "t_ap3", "/reject", "{\"reason\":\"짧아요\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("반려 이유를 10자 이상 적어 주세요."));
    call("ap3@example.com", "LEAD", "t_ap3", "/reject", "{\"reason\":\"헤드라인이 브랜드 말투와 맞지 않아요\"}")
        .andExpect(jsonPath("$.launchRequest.status").value("rejected"));

    // 반려된 요청은 승인할 수 없다.
    call("ap3@example.com", "LEAD", "t_ap3", "/approve", null).andExpect(status().isConflict());
    assertThat(StubLauncher.calls).isZero();
  }

  @Test
  void Meta_전송이_실패하면_멈추고_승인_없이_다시_시도한다() throws Exception {
    setup("ap4@example.com", "bp_ap4", "t_ap4");
    call("ap4@example.com", "LEAD", "t_ap4", "", null).andExpect(status().isOk());

    StubLauncher.failure = new IllegalStateException("A/B 게재 예산이 부족해요.");
    call("ap4@example.com", "LEAD", "t_ap4", "/approve", null)
        .andExpect(status().isBadGateway())
        .andExpect(jsonPath("$.error").value("A/B 게재 예산이 부족해요."));
    Tournament failed = repository.findById("t_ap4").orElseThrow();
    assertThat(failed.getLaunchRequest().getStatus()).isEqualTo("failed");
    assertThat(failed.getLastError()).contains("예산이 부족해요");

    StubLauncher.failure = null;
    call("ap4@example.com", "LEAD", "t_ap4", "/approve", null).andExpect(status().isOk());
    Tournament done = repository.findById("t_ap4").orElseThrow();
    assertThat(done.getRounds()).hasSize(1);
    assertThat(done.getLastError()).isNull();
  }

  @Test
  void 게재_전_검사에서_처음_걸린_것을_알려_준다() throws Exception {
    setup("ap5@example.com", "bp_ap5", "t_ap5");
    Tournament t = repository.findById("t_ap5").orElseThrow();
    t.setDailyBudget(5000.0);
    t.getDelivery().setLinkUrl("http://x.com");
    repository.saveAndFlush(t);

    call("ap5@example.com", "LEAD", "t_ap5", "", null)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("도착 주소는 https://로 시작해야 해요."));
  }
}
