package ai.adflow.api.tournament.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 골든 픽스처 — TS 엔진과 Java 엔진이 <b>같은 파일</b>을 읽어 같은 답을 내는지 지킨다 (설계 §8).
 *
 * <p>둘러보기는 TS 엔진으로 돌고 실사용 판정은 Java 엔진이 소유한다. 두 엔진이 상시 이중화되므로
 * 규칙을 한쪽만 고치면 둘러보기와 실사용의 판정이 갈린다 — 그 드리프트를 여기서 잡는다.
 *
 * <p>대응 TS: apps/web/src/entities/ab-test/tournament/golden.test.ts
 *
 * <p>@TestFactory 를 쓰는 이유: 픽스처 케이스마다 <b>이름 붙은 테스트</b>가 생겨야 실패했을 때
 * 어느 케이스가 갈라졌는지 바로 보인다. 루프 안 assert 는 첫 실패에서 멈춰 나머지를 가린다.
 */
class GoldenFixtureTest {

  /** V8 과 JVM 의 Math.exp 는 마지막 ulp 가 다를 수 있다. 정확 일치를 요구하면 CI 가 흔들린다. */
  private static final double EPSILON = 1e-9;

  private static final JsonMapper MAPPER = JsonMapper.builder().build();

  private static JsonNode fixture(String name) {
    String path = "tournament/" + name + ".json";
    try (InputStream in = GoldenFixtureTest.class.getClassLoader().getResourceAsStream(path)) {
      if (in == null) {
        throw new IllegalStateException(
            "골든 픽스처를 찾지 못했어요: " + path + " — build.gradle.kts 의 테스트 리소스 설정을 확인하세요.");
      }
      return MAPPER.readTree(in);
    } catch (IOException e) {
      throw new IllegalStateException("골든 픽스처를 읽지 못했어요: " + path, e);
    }
  }

  private static List<JsonNode> cases(String file, String suite) {
    JsonNode node = fixture(file).get(suite);
    if (node == null || !node.isArray() || node.isEmpty()) {
      throw new IllegalStateException(file + ".json 의 " + suite + " 케이스가 비어 있어요.");
    }
    List<JsonNode> out = new ArrayList<>();
    node.forEach(out::add);
    return out;
  }

  private static AdKpi kpi(JsonNode n) {
    return new AdKpi(
        n.get("impressions").asInt(),
        n.get("clicks").asInt(),
        n.get("ctr").asDouble(),
        n.get("spend").asDouble());
  }

  private static List<DynamicTest> suite(
      String file, String name, java.util.function.Consumer<JsonNode> check) {
    return cases(file, name).stream()
        .map(c -> DynamicTest.dynamicTest(name + " — " + c.get("name").asString(), () -> check.accept(c)))
        .collect(Collectors.toList());
  }

  /* ─── 1. seededUnit — 결정성의 뿌리 ─────────────────────────── */

  @TestFactory
  List<DynamicTest> seededUnit() {
    return suite(
        "seeded-unit",
        "seededUnit",
        c -> {
          JsonNode in = c.get("input");
          double actual = TourEngine.seededUnit(in.get("seed").asString(), in.get("index").asInt());
          // 정확 일치를 요구한다 — 정수 해시라 부동소수 오차가 끼어들 여지가 없다.
          // 여기가 갈라지면 아래 시드 KPI 전부가 갈라지므로 관대하게 봐주면 안 된다.
          assertThat(actual).isEqualTo(c.get("expected").asDouble());
        });
  }

  /* ─── 2. 판정 코어 ──────────────────────────────────────────── */

  @TestFactory
  List<DynamicTest> judgeRoundKpis() {
    return suite(
        "judge-round",
        "judgeRoundKpis",
        c -> {
          JsonNode in = c.get("input");
          JsonNode exp = c.get("expected");
          SettleResult actual =
              TourEngine.judgeRoundKpis(
                  kpi(in.get("kpis").get(0)),
                  kpi(in.get("kpis").get(1)),
                  in.get("elapsedDays").asInt(),
                  in.get("objective").asString());

          JsonNode expVerdict = exp.get("verdict");
          assertThat(actual.verdict().state()).isEqualTo(expVerdict.get("state").asString());
          assertThat(actual.verdict().ctrA()).isCloseTo(expVerdict.get("ctrA").asDouble(), within(EPSILON));
          assertThat(actual.verdict().ctrB()).isCloseTo(expVerdict.get("ctrB").asDouble(), within(EPSILON));
          assertThat(actual.verdict().confidence())
              .isCloseTo(expVerdict.get("confidence").asDouble(), within(EPSILON));
          assertThat(actual.rawWinner()).isEqualTo(exp.get("rawWinner").asString());
        });
  }

  @TestFactory
  List<DynamicTest> confidenceFromZTest() {
    return suite(
        "judge-round",
        "confidenceFromZTest",
        c -> {
          JsonNode in = c.get("input");
          assertThat(TourEngine.confidenceFromZTest(kpi(in.get("a")), kpi(in.get("b"))))
              .isCloseTo(c.get("expected").asDouble(), within(EPSILON));
        });
  }

  @TestFactory
  List<DynamicTest> confidenceFromCountTest() {
    return suite(
        "judge-round",
        "confidenceFromCountTest",
        c -> {
          JsonNode in = c.get("input");
          assertThat(
                  TourEngine.confidenceFromCountTest(
                      in.get("impA").asInt(), in.get("impB").asInt()))
              .isCloseTo(c.get("expected").asDouble(), within(EPSILON));
        });
  }

  /* ─── 3. 시드 KPI 생성기 ────────────────────────────────────── */

  private static void assertKpiEquals(AdKpi actual, JsonNode expected) {
    assertThat(actual.impressions()).isEqualTo(expected.get("impressions").asInt());
    assertThat(actual.clicks()).isEqualTo(expected.get("clicks").asInt());
    assertThat(actual.ctr()).isCloseTo(expected.get("ctr").asDouble(), within(EPSILON));
    assertThat(actual.spend()).isCloseTo(expected.get("spend").asDouble(), within(EPSILON));
  }

  private static Double factorOverride(JsonNode in) {
    JsonNode f = in.get("factorOverride");
    return f == null || f.isNull() ? null : f.asDouble();
  }

  @TestFactory
  List<DynamicTest> roundAdKpis() {
    return suite(
        "round-kpis",
        "roundAdKpis",
        c -> {
          JsonNode in = c.get("input");
          JsonNode r = in.get("round");
          AdKpi[] actual =
              TourEngine.roundAdKpis(
                  r.get("campaignId").asString(),
                  r.get("index").asInt(),
                  r.get("fastForwardDays").asInt(),
                  in.get("championCtr").asDouble(),
                  in.get("dailyBudget").asDouble(),
                  factorOverride(in),
                  in.get("objective").asString());
          assertKpiEquals(actual[0], c.get("expected").get(0));
          assertKpiEquals(actual[1], c.get("expected").get(1));
        });
  }

  @TestFactory
  List<DynamicTest> settleRound() {
    return suite(
        "round-kpis",
        "settleRound",
        c -> {
          JsonNode in = c.get("input");
          JsonNode r = in.get("round");
          JsonNode exp = c.get("expected");
          SettleResult actual =
              TourEngine.settleRound(
                  r.get("campaignId").asString(),
                  r.get("index").asInt(),
                  r.get("fastForwardDays").asInt(),
                  in.get("championCtr").asDouble(),
                  in.get("dailyBudget").asDouble(),
                  factorOverride(in),
                  in.get("objective").asString());

          assertKpiEquals(actual.kpis()[0], exp.get("kpis").get(0));
          assertKpiEquals(actual.kpis()[1], exp.get("kpis").get(1));
          assertThat(actual.verdict().state()).isEqualTo(exp.get("verdict").get("state").asString());
          assertThat(actual.verdict().confidence())
              .isCloseTo(exp.get("verdict").get("confidence").asDouble(), within(EPSILON));
          assertThat(actual.rawWinner()).isEqualTo(exp.get("rawWinner").asString());
        });
  }

  @TestFactory
  List<DynamicTest> roundCampaignId() {
    return suite(
        "round-kpis",
        "roundCampaignId",
        c -> {
          JsonNode in = c.get("input");
          assertThat(TourEngine.roundCampaignId(in.get("tournamentId").asString(), in.get("index").asInt()))
              .isEqualTo(c.get("expected").asString());
        });
  }

  /* ─── 4. 상태 판정 ──────────────────────────────────────────── */

  @TestFactory
  List<DynamicTest> tournamentState() {
    return suite(
        "tournament-state",
        "cases",
        c -> {
          TourState t = TourState.fromJson(c.get("input"));
          JsonNode exp = c.get("expected");
          assertThat(TourEngine.deriveBeat(t)).isEqualTo(exp.get("deriveBeat").asString());
          assertThat(TourEngine.championDefendStreak(t))
              .isEqualTo(exp.get("championDefendStreak").asInt());
          assertThat(TourEngine.hasConverged(t)).isEqualTo(exp.get("hasConverged").asBoolean());
          assertThat(TourEngine.isEnvelopeExhausted(t))
              .isEqualTo(exp.get("isEnvelopeExhausted").asBoolean());
          assertThat(TourEngine.canAutoRefill(t)).isEqualTo(exp.get("canAutoRefill").asBoolean());
          assertThat(TourEngine.endCompletionReason(t))
              .isEqualTo(exp.get("endCompletionReason").asString());
        });
  }

  @TestFactory
  List<DynamicTest> deriveAxis() {
    return suite(
        "tournament-state",
        "deriveAxis",
        c -> {
          JsonNode in = c.get("input");
          assertThat(
                  TourEngine.deriveAxis(
                      TourVariant.fromJson(in.get("champion")), TourVariant.fromJson(in.get("challenger"))))
              .isEqualTo(c.get("expected").asString());
        });
  }

  @TestFactory
  List<DynamicTest> nextAxis() {
    return suite(
        "tournament-state",
        "nextAxis",
        c ->
            assertThat(TourEngine.nextAxis(c.get("input").get("cursor").asInt()))
                .isEqualTo(c.get("expected").asString()));
  }

  /* ─── 5. 가설 결정 ──────────────────────────────────────────── */

  private static List<Hypothesis> entries(JsonNode arr) {
    List<Hypothesis> out = new ArrayList<>();
    arr.forEach(n -> out.add(Hypothesis.fromJson(n)));
    return out;
  }

  private static LedgerContext ctx(JsonNode n) {
    JsonNode persona = n.get("personaId");
    return new LedgerContext(
        n.get("productId").asString(),
        persona == null || persona.isNull() ? null : persona.asString(),
        n.get("objective").asString());
  }

  @TestFactory
  List<DynamicTest> leverPool() {
    // 추천 3훅의 순서까지 계약이다. 이게 갈라지면 같은 Ledger 에서 다른 레버가 선택된다.
    return suite(
        "hypothesis",
        "leverPool",
        c -> {
          List<String> expected = new ArrayList<>();
          c.get("expected").forEach(n -> expected.add(n.asString()));
          assertThat(Levers.pool(c.get("input").get("objective").asString()))
              .containsExactlyElementsOf(expected);
        });
  }

  @TestFactory
  List<DynamicTest> selectNextLever() {
    return suite(
        "hypothesis",
        "selectNextLever",
        c -> {
          JsonNode in = c.get("input");
          assertThat(
                  TourHypothesis.selectNextLever(
                      entries(in.get("entries")), ctx(in.get("ctx")), in.get("seed").asInt()))
              .isEqualTo(c.get("expected").asString());
        });
  }

  @TestFactory
  List<DynamicTest> summarizeLedger() {
    return suite(
        "hypothesis",
        "summarizeLedger",
        c -> {
          JsonNode in = c.get("input");
          JsonNode exp = c.get("expected");
          LedgerSummary s = TourHypothesis.summarizeLedger(entries(in.get("entries")), ctx(in.get("ctx")));

          assertThat(s.confirmed().stream().sorted().toList()).isEqualTo(strings(exp.get("confirmed")));
          assertThat(s.refuted().stream().sorted().toList()).isEqualTo(strings(exp.get("refuted")));
          assertThat(s.tested().stream().sorted().toList()).isEqualTo(strings(exp.get("tested")));
          assertThat(s.relevant().stream().map(Hypothesis::id).sorted().toList())
              .isEqualTo(strings(exp.get("relevantIds")));
        });
  }

  private static List<String> strings(JsonNode arr) {
    List<String> out = new ArrayList<>();
    arr.forEach(n -> out.add(n.asString()));
    return out.stream().sorted().collect(Collectors.toList());
  }

  @TestFactory
  List<DynamicTest> buildHypothesis() {
    return suite(
        "hypothesis",
        "buildHypothesis",
        c -> {
          JsonNode in = c.get("input");
          JsonNode exp = c.get("expected");
          Hypothesis h =
              TourHypothesis.buildHypothesis(
                  in.get("lever").asString(),
                  ctx(in.get("ctx")),
                  in.get("rationaleSource").asString(),
                  in.get("idSeed").asString());

          assertThat(h.id()).isEqualTo(exp.get("id").asString());
          assertThat(h.lever()).isEqualTo(exp.get("lever").asString());
          assertThat(h.statement()).isEqualTo(exp.get("statement").asString());
          assertThat(h.predictedMetric()).isEqualTo(exp.get("predictedMetric").asString());
          assertThat(h.predictedDirection()).isEqualTo(exp.get("predictedDirection").asString());
          assertThat(h.rationale()).isEqualTo(exp.get("rationale").asString());
          assertThat(h.rationaleSource()).isEqualTo(exp.get("rationaleSource").asString());
          assertThat(h.status()).isEqualTo(exp.get("status").asString());
          assertThat(h.contextTags().productId())
              .isEqualTo(exp.get("contextTags").get("productId").asString());
          assertThat(h.contextTags().objective())
              .isEqualTo(exp.get("contextTags").get("objective").asString());
        });
  }

  @TestFactory
  List<DynamicTest> resolveHypothesis() {
    return suite(
        "hypothesis",
        "resolveHypothesis",
        c -> {
          JsonNode in = c.get("input");
          JsonNode exp = c.get("expected");
          JsonNode v = in.get("verdict");
          Hypothesis resolved =
              TourHypothesis.resolveHypothesis(
                  Hypothesis.fromJson(in.get("hypothesis")),
                  new RoundVerdict(
                      v.get("state").asString(),
                      v.get("ctrA").asDouble(),
                      v.get("ctrB").asDouble(),
                      v.get("confidence").asDouble()),
                  in.get("rawWinner").asString(),
                  in.get("resolvedAt").asString());

          assertThat(resolved.status()).isEqualTo(exp.get("status").asString());
          assertThat(resolved.verdict()).isEqualTo(exp.get("verdict").asString());
          assertThat(resolved.effectSize())
              .isCloseTo(exp.get("effectSize").asDouble(), within(EPSILON));
          assertThat(resolved.resolvedAt()).isEqualTo(exp.get("resolvedAt").asString());
        });
  }

  @TestFactory
  List<DynamicTest> demoLeverFactor() {
    return suite(
        "hypothesis",
        "demoLeverFactor",
        c -> {
          JsonNode in = c.get("input");
          assertThat(
                  TourHypothesis.demoLeverFactor(
                      in.get("lever").asString(), in.get("campaignId").asString()))
              .isCloseTo(c.get("expected").asDouble(), within(EPSILON));
        });
  }

  @TestFactory
  List<DynamicTest> leverMeta() {
    return suite(
        "hypothesis",
        "leverMeta",
        c -> {
          String lever = c.get("input").get("lever").asString();
          JsonNode exp = c.get("expected");
          assertThat(Levers.label(lever)).isEqualTo(exp.get("label").asString());
          assertThat(Levers.isCopy(lever)).isEqualTo(exp.get("isCopy").asBoolean());
          assertThat(Levers.swapsHeadline(lever)).isEqualTo(exp.get("swapsHeadline").asBoolean());
        });
  }

  @TestFactory
  List<DynamicTest> tourMetricSpec() {
    return suite(
        "hypothesis",
        "tourMetricSpec",
        c -> {
          JsonNode exp = c.get("expected");
          TourMetricSpec s = TourMetricSpec.of(c.get("input").get("objective").asString());
          assertThat(s.id()).isEqualTo(exp.get("id").asString());
          assertThat(s.kind()).isEqualTo(exp.get("kind").asString());
          assertThat(s.rateLabel()).isEqualTo(exp.get("rateLabel").asString());
          assertThat(s.seedDefault()).isCloseTo(exp.get("seedDefault").asDouble(), within(EPSILON));
          assertThat(s.higherBetter()).isEqualTo(exp.get("higherBetter").asBoolean());
          assertThat(s.leadEpsilon()).isCloseTo(exp.get("leadEpsilon").asDouble(), within(EPSILON));
        });
  }
}
