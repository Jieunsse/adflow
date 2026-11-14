package ai.adflow.api.tournament;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ai.adflow.api.meta.MetaGraphClient;
import ai.adflow.api.plan.MonthlyPlan;
import ai.adflow.api.plan.MonthlyPlanRepository;
import ai.adflow.api.security.Role;
import ai.adflow.api.workspace.Member;
import ai.adflow.api.workspace.MemberRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** 광고비 자동 멈춤 (기능 13, 정책서 12.1). */
@SpringBootTest
@ActiveProfiles("test")
@Import(SpendGuardTest.Stubs.class)
class SpendGuardTest {

  /** Meta 를 부르지 않고 어떤 상태로 바꾸라고 했는지만 적는다. */
  static class StubGraph extends MetaGraphClient {
    static final List<String> calls = new ArrayList<>();

    StubGraph() {
      super(new ObjectMapper(), "http://stub");
    }

    @Override
    public JsonNode post(String path, Map<String, Object> body, String token) {
      calls.add(path + " " + body.get("status"));
      return null;
    }
  }

  @TestConfiguration
  static class Stubs {
    @Bean
    @Primary
    MetaGraphClient stubGraph() {
      return new StubGraph();
    }
  }

  @Autowired private SpendGuard guard;
  @Autowired private TournamentEditService edit;
  @Autowired private TournamentRepository repository;
  @Autowired private MonthlyPlanRepository plans;
  @Autowired private MemberRepository members;

  @BeforeEach
  void reset() {
    StubGraph.calls.clear();
  }

  @Test
  void 누적_광고비가_하루_예산_곱하기_날수의_2배를_넘으면_이상이다() {
    assertThat(SpendGuard.overspent(60_001, 30_000, 5)).isTrue(); // 첫날도 1일로 센다
    assertThat(SpendGuard.overspent(60_000, 30_000, 5)).isFalse();
    assertThat(SpendGuard.overspent(190_000, 30_000, 72)).isTrue(); // 3일째 한도 18만
    assertThat(SpendGuard.overspent(170_000, 30_000, 72)).isFalse();
  }

  private Tournament running(String ws, String id, String brand, double spend) {
    Tournament.Variant v = new Tournament.Variant();
    v.setHeadline("h");
    v.setPrimaryText("p");
    TourRound r = new TourRound();
    r.setIndex(1);
    r.setAxis("headline");
    r.setCampaignId("camp_" + id);
    r.setChampion(v);
    r.setChallenger(v);
    r.setFastForwardDays(0);
    r.setStatus("running");
    r.setLaunchedAt(Instant.now().minus(Duration.ofHours(30)).toString());
    r.setSpendToDate(spend);

    Tournament t = new Tournament();
    t.setId(id);
    t.setOwnerKey(ws);
    t.setUpdatedAt(Instant.now());
    t.setBrandProfileId(brand);
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
    t.setRounds(new ArrayList<>(List.of(r)));
    TournamentDelivery d = new TournamentDelivery();
    d.setAccessToken("tok");
    d.setAdAccountId("act");
    d.setPageId("pg");
    d.setOwnerEmail("u@x.com");
    t.setDelivery(d);
    return repository.saveAndFlush(t);
  }

  @Test
  void 광고비_이상이면_Meta_에서_끄고_다시_시작하면_켠다() {
    running("ws_sg1", "t_sg1", "bp_sg1", 200_000); // 2일째 한도 12만

    assertThat(guard.check("t_sg1")).isTrue();
    Tournament t = repository.findById("t_sg1").orElseThrow();
    assertThat(t.getStopReason()).isEqualTo(SpendGuard.SPEND_ANOMALY);
    assertThat(t.getLastError()).isEqualTo(SpendGuard.ANOMALY_MESSAGE);
    assertThat(StubGraph.calls).containsExactly("/camp_t_sg1 PAUSED");

    edit.resume("t_sg1");
    Tournament resumed = repository.findById("t_sg1").orElseThrow();
    assertThat(resumed.getStopReason()).isNull();
    assertThat(resumed.getLastError()).isNull();
    assertThat(StubGraph.calls).containsExactly("/camp_t_sg1 PAUSED", "/camp_t_sg1 ACTIVE");
  }

  @Test
  void 정상_광고비면_멈추지_않는다() {
    running("ws_sg2", "t_sg2", "bp_sg2", 50_000);
    assertThat(guard.check("t_sg2")).isFalse();
    assertThat(StubGraph.calls).isEmpty();
  }

  @Test
  void 대행_브랜드가_월_상한에_닿으면_브랜드의_실험을_모두_멈추고_상한이_늘기_전엔_다시_시작할_수_없다() {
    String ws = "ws_sg3";
    Member client = new Member("client@sg3.com", ws, Role.CLIENT, Instant.now());
    client.setBrandProfileId("bp_sg3");
    members.save(client);
    MonthlyPlan plan = new MonthlyPlan();
    String month = YearMonth.now(ZoneId.of("Asia/Seoul")).toString();
    plan.setId(MonthlyPlanRepository.idOf("bp_sg3", month));
    plan.setOwnerKey(ws);
    plan.setUpdatedAt(Instant.now());
    plan.setBrandProfileId("bp_sg3");
    plan.setMonth(month);
    plan.setStatus(MonthlyPlan.APPROVED);
    plan.setBudgetCap(100_000L);
    plans.save(plan);

    running(ws, "t_sg3a", "bp_sg3", 55_000);
    running(ws, "t_sg3b", "bp_sg3", 50_000); // 합 10만 5천 ≥ 상한 10만

    assertThat(guard.check("t_sg3a")).isTrue();
    assertThat(repository.findById("t_sg3a").orElseThrow().getStopReason()).isEqualTo(SpendGuard.MONTHLY_CAP);
    assertThat(repository.findById("t_sg3b").orElseThrow().getStopReason()).isEqualTo(SpendGuard.MONTHLY_CAP);

    assertThatThrownBy(() -> edit.resume("t_sg3a")).hasMessageContaining("상한이 아직 그대로");

    // 고객이 상한을 늘려 승인하면 다시 시작할 수 있다.
    plan.setBudgetCap(300_000L);
    plans.save(plan);
    edit.resume("t_sg3a");
    assertThat(repository.findById("t_sg3a").orElseThrow().getLastError()).isNull();
  }
}
