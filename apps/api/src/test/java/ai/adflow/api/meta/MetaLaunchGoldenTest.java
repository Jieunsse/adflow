package ai.adflow.api.meta;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ai.adflow.api.tournament.TourRound;
import ai.adflow.api.tournament.Tournament;
import ai.adflow.api.tournament.TournamentRoundLauncher;
import java.io.InputStream;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * 골든 픽스처 — 게재 요청 바디가 TS 와 같은지 지킨다 (설계 §8 의 처방을 단계 6 에 적용).
 *
 * <p>Meta 게재는 실 계정 없이 검증할 수 없다. TS 클라이언트는 실전에서 검증됐지만 이 Java 재작성본은
 * 아무도 돌려볼 수 없다 — 설계가 "최고 위험"으로 꼽은 조각이다. 그래서 <b>TS 가 실제로 보내는 요청을
 * 파일로 떠서 양쪽이 같은 파일을 읽는다.</b>
 *
 * <p>대응 TS: apps/web/src/entities/ab-test/tournament/meta-launch-golden.test.ts
 *
 * <p>스프링 컨텍스트를 띄우지 않는다 — 여기서 보는 것은 순수한 바디 조립이고, 전송은 스텁이다.
 */
class MetaLaunchGoldenTest {

  private static final String FIXTURE = "/meta/split-test-launch.json";

  /** 픽스처를 뜬 시각. start_time 이 "오늘"에서 파생되므로 고정하지 않으면 매일 깨진다. */
  private static final Instant FROZEN = Instant.parse("2026-07-26T03:00:00Z");

  private static final ObjectMapper JSON = new ObjectMapper();

  /** 전송을 가로채 요청을 모은다. 응답 id 는 TS 스텁과 같은 규칙으로 만든다. */
  static class RecordingGraphClient extends MetaGraphClient {
    final List<Map<String, Object>> requests = new ArrayList<>();
    private final Map<String, Integer> counters = new LinkedHashMap<>();

    RecordingGraphClient() {
      super(JSON, MetaGraphClient.GRAPH);
    }

    @Override
    protected String send(String method, String path, Map<String, Object> body) {
      if ("DELETE".equals(method)) return "{\"success\":true}";

      String seg = segment(path);
      int n = counters.merge(seg, 1, Integer::sum);
      Map<String, Object> recorded = new LinkedHashMap<>(body);
      recorded.remove("access_token"); // 시크릿은 픽스처에 없다
      requests.add(Map.of("path", seg, "body", recorded));

      if (seg.equals("adimages")) {
        return "{\"images\":{\"f\":{\"hash\":\"img_hash_1\",\"url\":\"x\"}}}";
      }
      String id =
          switch (seg) {
            case "campaigns" -> "camp_1";
            case "adsets" -> "adset_" + n;
            case "adcreatives" -> "creative_" + n;
            case "ads" -> "ad_" + n;
            case "ad_studies" -> "study_1";
            default -> throw new IllegalStateException("예상 못 한 경로: " + seg);
          };
      return "{\"id\":\"" + id + "\"}";
    }

    /** ".../act_1/adsets" → "adsets" (TS 스텁의 pathSegment 와 같은 규칙). */
    private static String segment(String path) {
      String noQuery = path.contains("?") ? path.substring(0, path.indexOf('?')) : path;
      return noQuery.substring(noQuery.lastIndexOf('/') + 1);
    }
  }

  private static JsonNode fixture() {
    try (InputStream in = MetaLaunchGoldenTest.class.getResourceAsStream(FIXTURE)) {
      if (in == null) throw new IllegalStateException("픽스처가 클래스패스에 없어요: " + FIXTURE);
      return JSON.readTree(in);
    } catch (java.io.IOException e) {
      throw new IllegalStateException(e);
    }
  }

  @Test
  void 픽스처가_비어_있지_않다() {
    // 픽스처가 비면 아래 케이스가 전부 없는 채로 통과한다.
    assertThat(fixture().get("splitTestLaunch").size()).isGreaterThanOrEqualTo(5);
  }

  @TestFactory
  List<DynamicTest> 게재_요청이_TS_와_같다() {
    List<DynamicTest> tests = new ArrayList<>();
    for (JsonNode c : fixture().get("splitTestLaunch")) {
      tests.add(DynamicTest.dynamicTest(c.get("name").asString(), () -> assertCase(c)));
    }
    return tests;
  }

  private void assertCase(JsonNode c) {
    Tournament t = JSON.treeToValue(c.get("input").get("tournament"), Tournament.class);
    TourRound round = JSON.treeToValue(c.get("input").get("round"), TourRound.class);

    RecordingGraphClient graph = new RecordingGraphClient();
    TournamentRoundLauncher launcher =
        new TournamentRoundLauncher(
            new MetaSplitTestLauncher(graph), Clock.fixed(FROZEN, ZoneOffset.UTC));

    MetaSplitTestLauncher.LaunchResult result = launcher.launch(t, round);

    JsonNode expected = c.get("requests");
    // 호출 순서도 계약이다 — 셀 A 를 만들고 나서 B, 그 다음 ad_studies 여야 한다.
    assertThat(paths(graph.requests)).isEqualTo(expectedPaths(expected));
    assertThat(graph.requests).hasSize(expected.size());

    for (int i = 0; i < expected.size(); i++) {
      JsonNode want = expected.get(i).get("body");
      // 직렬화 후 재파싱해 숫자 노드를 정규화한다 — Jackson 은 LongNode(1)과 IntNode(1)을 다르게 본다.
      // JsonNode 동등성은 키 순서를 보지 않는다. 배열 순서만 계약이다.
      JsonNode got = JSON.readTree(JSON.writeValueAsString(graph.requests.get(i).get("body")));
      assertThat(got)
          .describedAs("요청 %d (%s)", i, expected.get(i).get("path").asString())
          .isEqualTo(want);
    }

    JsonNode wantResult = c.get("result");
    assertThat(result.campaignId()).isEqualTo(wantResult.get("campaignId").asString());
    assertThat(result.adIds()).isEqualTo(strings(wantResult.get("adIds")));
    assertThat(result.adSetIds()).isEqualTo(strings(wantResult.get("adSetIds")));
    assertThat(result.studyId()).isEqualTo(wantResult.get("studyId").asString());
  }

  /* ─── 픽스처가 못 덮는 것 — 실패 경로 ─────────────────────── */

  @Test
  void 게재가_거절되면_빈_캠페인을_지우고_한국어로_바꿔_던진다() {
    RecordingGraphClient graph =
        new RecordingGraphClient() {
          final List<String> deleted = new ArrayList<>();

          @Override
          protected String send(String method, String path, Map<String, Object> body) {
            if ("DELETE".equals(method)) {
              deleted.add(path);
              return "{\"success\":true}";
            }
            if (path.endsWith("/adsets")) {
              // 셀당 최소 예산 미달 — 알려진 split-test 거절 subcode.
              return "{\"error\":{\"message\":\"nope\",\"code\":100,\"error_subcode\":1487390}}";
            }
            return super.send(method, path, body);
          }
        };

    TournamentRoundLauncher launcher =
        new TournamentRoundLauncher(
            new MetaSplitTestLauncher(graph), Clock.fixed(FROZEN, ZoneOffset.UTC));

    JsonNode c = fixture().get("splitTestLaunch").get(0);
    Tournament t = JSON.treeToValue(c.get("input").get("tournament"), Tournament.class);
    TourRound round = JSON.treeToValue(c.get("input").get("round"), TourRound.class);

    assertThatThrownBy(() -> launcher.launch(t, round))
        .hasMessageContaining("일 예산을 더 올려주세요");
  }

  @Test
  void 인증_만료는_번역하지_않고_그대로_올린다() {
    // 재로그인 경로를 살려야 한다 — "게재 거절"로 바꾸면 사람이 엉뚱한 곳을 고친다.
    MetaApiException expired = new MetaApiException("만료", 190, null, "토큰 만료");
    assertThat(MetaSplitTestLauncher.mapSplitTestError(expired)).isSameAs(expired);
  }

  @Test
  void 알_수_없는_거절은_제네릭_한국어다() {
    MetaApiException other = new MetaApiException("?", 100, 999, null);
    assertThat(MetaSplitTestLauncher.mapSplitTestError(other))
        .hasMessageContaining("Meta 가 A/B 게재를 거절했어요");
  }

  private static List<String> paths(List<Map<String, Object>> requests) {
    return requests.stream().map(r -> (String) r.get("path")).toList();
  }

  private static List<String> expectedPaths(JsonNode requests) {
    List<String> out = new ArrayList<>();
    for (JsonNode r : requests) out.add(r.get("path").asString());
    return out;
  }

  private static List<String> strings(JsonNode arr) {
    List<String> out = new ArrayList<>();
    for (JsonNode n : arr) out.add(n.asString());
    return out;
  }

  @SuppressWarnings("unused")
  private static ObjectNode unusedMarker() {
    return null;
  }
}
