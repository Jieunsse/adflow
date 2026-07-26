package ai.adflow.api.tournament;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.internal.cron.CronRunRepository;
import ai.adflow.api.meta.MetaSplitTestLauncher;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;

/**
 * auto 무인 체인 — TS server-runner 에 있던 게이트·부트스트랩 검증을 Java 가 인수했다.
 *
 * <p>Gemini(Next 역위임)와 Meta 게재는 스텁이다. 여기서 보는 것은 <b>언제 게재하고 언제 멈추는가</b>다.
 * 게재 요청의 내용은 MetaLaunchGoldenTest 가 픽스처로 지킨다.
 */
@SpringBootTest
@ActiveProfiles("test")
class TournamentAdvanceServiceTest {

  static class StubCopy extends ChallengerCopyClient {
    static boolean fail = false;

    StubCopy() {
      super(null);
    }

    @Override
    public Copy generate(Tournament t) {
      if (fail) throw new IllegalStateException("Gemini 일시 실패");
      return new Copy(List.of("챌린저 헤드1", "챌린저 헤드2"), List.of("챌린저 카피1", "챌린저 카피2"));
    }
  }

  static class StubLauncher extends TournamentRoundLauncher {
    static RuntimeException failure = null;
    static int calls = 0;

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
    ChallengerCopyClient stubCopy() {
      return new StubCopy();
    }

    @Bean
    @Primary
    TournamentRoundLauncher stubLauncher() {
      return new StubLauncher();
    }
  }

  @Autowired private TournamentAdvanceService advance;
  @Autowired private TournamentRepository repository;
  @Autowired private TournamentPoller poller;
  @Autowired private CronRunRepository cronRuns;

  @BeforeEach
  void reset() {
    StubCopy.fail = false;
    StubLauncher.failure = null;
    StubLauncher.calls = 0;
    repository.deleteAll();
  }

  private static Tournament.Variant variant(String h, String p) {
    Tournament.Variant v = new Tournament.Variant();
    v.setHeadline(h);
    v.setPrimaryText(p);
    return v;
  }

  private Tournament save(String id) {
    Tournament t = new Tournament();
    t.setId(id);
    t.setOwnerKey("u@x.com");
    t.setUpdatedAt(Instant.now());
    t.setBrandProfileId("bp_1");
    t.setProductId("prod_1");
    t.setProductName("세럼");
    t.setTone("warm");
    t.setObjective("traffic");
    t.setDailyBudget(30000.0);
    t.setChampion(variant("기존 헤드라인", "기존 본문"));
    t.setChampionCtr(1.5);
    t.setChampionConfirmed(true);
    t.setAxisCursor(0);
    t.setSpentBudget(0.0);
    t.setStatus("running");
    t.setCreatedAt("2026-07-01T00:00:00Z");
    t.setRounds(new ArrayList<>());

    Tournament.Envelope env = new Tournament.Envelope();
    env.setTotalBudget(1_000_000.0);
    t.setEnvelope(env);

    TournamentDelivery d = new TournamentDelivery();
    d.setAccessToken("tok");
    d.setAdAccountId("act_1");
    d.setPageId("page_1");
    d.setOwnerEmail("u@x.com");
    d.setLinkUrl("https://x.com");
    d.setCtaType("LEARN_MORE");
    d.setCountries(List.of("KR"));
    d.setAgeMin(20);
    d.setAgeMax(45);
    d.setRoundDays(4);
    d.setGoalId("traffic");
    t.setDelivery(d);

    return repository.saveAndFlush(t);
  }

  @Test
  void 부트스트랩_1라운드를_자동으로_띄운다() {
    save("t_boot");

    assertThat(advance.autoAdvance("t_boot")).isTrue();

    Tournament t = repository.findById("t_boot").orElseThrow();
    assertThat(t.getRounds()).hasSize(1);
    assertThat(t.getRounds().get(0).getStatus()).isEqualTo("running");
    assertThat(t.getRounds().get(0).getAdIds()).containsExactly("ad_1", "ad_2");
    assertThat(t.getRounds().get(0).getStudyId()).isEqualTo("study_1");
    assertThat(t.getRounds().get(0).getLaunchedAt()).isNotNull();
    // ADR-044 — 가설은 게재 시점에 proposed → testing 으로 옮겨간다.
    assertThat(t.getRounds().get(0).getHypothesis().getStatus()).isEqualTo("testing");
    assertThat(t.getPendingChallenger()).isNull();
    assertThat(t.getPendingHypothesis()).isNull();
  }

  @Test
  void 챔피언_미확정이면_게재하지_않는다() {
    Tournament t = save("t_gate");
    t.setChampionConfirmed(false);
    repository.saveAndFlush(t);

    assertThat(advance.autoAdvance("t_gate")).isFalse();
    assertThat(StubLauncher.calls).isZero();
  }

  @Test
  void 진행_중인_라운드가_있으면_겹쳐_띄우지_않는다() {
    save("t_running");
    advance.autoAdvance("t_running");
    assertThat(StubLauncher.calls).isEqualTo(1);

    assertThat(advance.autoAdvance("t_running")).isFalse();
    assertThat(StubLauncher.calls).isEqualTo(1);
  }

  @Test
  void 봉투가_소진되면_멈춘다() {
    Tournament t = save("t_spent");
    t.setSpentBudget(1_000_000.0); // totalBudget 도달
    repository.saveAndFlush(t);

    assertThat(advance.autoAdvance("t_spent")).isFalse();
    assertThat(StubLauncher.calls).isZero();
  }

  @Test
  void 자동충전이_켜져_있으면_소진돼도_채우고_계속한다() {
    // ADR-061 — opt-in 이고 hardCap 미만일 때만.
    Tournament t = save("t_refill");
    t.setSpentBudget(1_000_000.0);
    Tournament.AutoRefill ar = new Tournament.AutoRefill();
    ar.setAddBudget(300_000.0);
    ar.setHardCap(2_000_000.0);
    t.getEnvelope().setAutoRefill(ar);
    repository.saveAndFlush(t);

    assertThat(advance.autoAdvance("t_refill")).isTrue();
    assertThat(repository.findById("t_refill").orElseThrow().getEnvelope().getTotalBudget())
        .isEqualTo(1_300_000.0);
  }

  @Test
  void hardCap_에_닿으면_충전하지_않고_멈춘다() {
    Tournament t = save("t_cap");
    t.setSpentBudget(2_000_000.0);
    Tournament.AutoRefill ar = new Tournament.AutoRefill();
    ar.setAddBudget(300_000.0);
    ar.setHardCap(2_000_000.0);
    t.getEnvelope().setAutoRefill(ar);
    t.getEnvelope().setTotalBudget(2_000_000.0);
    repository.saveAndFlush(t);

    assertThat(advance.autoAdvance("t_cap")).isFalse();
    assertThat(StubLauncher.calls).isZero();
  }

  @Test
  void 게재_실패는_한국어로_박아두고_자동_진행을_멈춘다() {
    // ADR-053 — 사전 탐지가 불가능한 거절이라 사람이 볼 수 있게 남긴다.
    save("t_err");
    StubLauncher.failure = new IllegalStateException("A/B 게재 예산이 부족해요.");

    assertThat(advance.autoAdvance("t_err")).isFalse();
    Tournament t = repository.findById("t_err").orElseThrow();
    assertThat(t.getLastError()).contains("예산이 부족해요");
    assertThat(t.getRounds()).isEmpty();

    // 멈춘 뒤에는 다시 시도하지 않는다 — 사람이 resume 할 때까지.
    StubLauncher.failure = null;
    assertThat(advance.autoAdvance("t_err")).isFalse();
    assertThat(repository.findById("t_err").orElseThrow().getRounds()).isEmpty();
  }

  @Test
  void 카피_생성_실패는_일시적이라_아무것도_남기지_않는다() {
    save("t_gemini");
    StubCopy.fail = true;

    assertThat(advance.autoAdvance("t_gemini")).isFalse();
    Tournament t = repository.findById("t_gemini").orElseThrow();
    assertThat(t.getLastError()).isNull(); // 다음 폴에 재시도한다
    assertThat(t.getRounds()).isEmpty();
  }

  @Test
  void 이전_토너먼트에서_반증된_레버는_다음_가설에서_회피된다() {
    // ADR-047 — Ledger 투영이 실제로 결정에 반영되는지.
    save("t_prior");
    advance.autoAdvance("t_prior");
    Tournament first = repository.findById("t_prior").orElseThrow();
    String refutedLever = first.getRounds().get(0).getHypothesis().getLever();

    // 그 라운드를 "챔피언 방어(반증)"로 마감시킨다.
    TourRound r = first.getRounds().get(0);
    TourRound.Verdict v = new TourRound.Verdict();
    v.setState("winner");
    v.setCtrA(2.0);
    v.setCtrB(1.0);
    v.setConfidence(0.97);
    r.setVerdict(v);
    r.setRawWinner("A");
    r.setStatus("settled");
    r.getHypothesis().setStatus("resolved");
    r.getHypothesis().setVerdict("refuted");
    repository.saveAndFlush(first);

    save("t_next");
    advance.propose(repository.findById("t_next").orElseThrow());
    Tournament next = repository.findById("t_next").orElseThrow();
    advance.autoAdvance("t_next");

    String nextLever =
        repository.findById("t_next").orElseThrow().getRounds().get(0).getHypothesis().getLever();
    assertThat(nextLever).isNotEqualTo(refutedLever);
  }

  @Test
  void 폴러가_한_바퀴_돌고_자기기록을_남긴다() {
    // ADR-042 — 기록이 없으면 health 의 dead-man's switch 가 "폴러가 죽었다"고 오탐한다.
    save("t_poll");

    TournamentPoller.Cycle c = poller.runOnce();

    assertThat(c.scanned()).isEqualTo(1);
    assertThat(c.advanced()).isEqualTo(1); // 결산은 안 됐지만 1라운드는 띄운다
    assertThat(c.errors()).isEmpty();
    assertThat(cronRuns.findFirstByJobAndOkTrueOrderByFinishedAtDesc("tournament-poller"))
        .isPresent();
  }

  @Test
  void 게재_실패로_멈춘_토너먼트는_폴러가_건드리지_않는다() {
    Tournament t = save("t_skip");
    t.setLastError("게재 실패");
    repository.saveAndFlush(t);

    assertThat(poller.runOnce().scanned()).isZero();
    assertThat(StubLauncher.calls).isZero();
  }
}
